#!/bin/bash

app="${app:-${YNH_APP_ID:-core_lightning}}"
install_dir="${install_dir:-$(ynh_app_setting_get --app="$app" --key=install_dir 2>/dev/null || true)}"
data_dir="${data_dir:-$(ynh_app_setting_get --app="$app" --key=data_dir 2>/dev/null || true)}"
install_dir="${install_dir:-/var/www/$app}"
data_dir="${data_dir:-/home/yunohost.app/$app}"
config_dir="/etc/$app"
config_file="$config_dir/lightningd.conf"
network="bitcoin"
service_name="$app"
lightningd_bin="$install_dir/bin/lightningd"
lightning_cli="$install_dir/bin/lightning-cli"

bitcoin_app="bitcoin_core"
bitcoin_config_dir="/etc/$bitcoin_app"
bitcoin_config_file="$bitcoin_config_dir/bitcoin.conf"
bitcoin_cln_credential_file="$bitcoin_config_dir/core-lightning.rpc"
bitcoin_data_dir="$(ynh_app_setting_get --app="$bitcoin_app" --key=data_dir 2>/dev/null || true)"
bitcoin_cli="$(ynh_app_setting_get --app="$bitcoin_app" --key=install_dir 2>/dev/null || true)/bitcoin-31.1/bin/bitcoin-cli"

ynh_cln_setting() {
	local key="$1" default="$2" value
	value="$(ynh_app_setting_get --app="$app" --key="$key" 2>/dev/null || true)"
	printf '%s' "${value:-$default}"
}

ynh_cln_require_bitcoin_app() {
	if ! yunohost app list --output-as json 2>/dev/null | jq -e --arg app "$bitcoin_app" '[.apps[]?.id] | index($app) != null' >/dev/null; then
		ynh_die "Core Lightning requires a Bitcoin backend. Install Bitcoin Core for YunoHost first."
	fi
	[ -r "$bitcoin_config_file" ] || ynh_die "Bitcoin Core was detected, but $bitcoin_config_file is not readable."
	[ -n "$bitcoin_data_dir" ] || ynh_die "Bitcoin Core data directory could not be discovered."
}

ynh_cln_read_bitcoin_rpc_credentials() {
	bitcoin_rpc_user="$(sed -n -E 's/^user=(.*)$/\1/p' "$bitcoin_cln_credential_file" | tail -n1)"
	bitcoin_rpc_password="$(sed -n -E 's/^password=(.*)$/\1/p' "$bitcoin_cln_credential_file" | tail -n1)"
	if [ -z "$bitcoin_rpc_user" ] || [ -z "$bitcoin_rpc_password" ]; then
		ynh_die "Bitcoin Core is installed, but bitcoin-core_ynh has not provisioned the dedicated Core Lightning RPC credential at $bitcoin_cln_credential_file. Upgrade or repair Bitcoin Core first; refusing to grant CLN broad cookie access."
	fi
}

ynh_cln_write_config() {
	mkdir -p "$config_dir"
	{
		echo "# Managed by YunoHost package $app. Edit through the config panel when possible."
		echo "network=$network"
		echo "alias=$(ynh_cln_setting alias 'My YunoHost Lightning Node')"
		echo "lightning-dir=$data_dir"
		echo "rpc-file=$data_dir/bitcoin/lightning-rpc"
		echo "log-file=$data_dir/bitcoin/lightningd.log"
		echo "log-level=$(ynh_cln_setting log_level info)"
		echo "bitcoin-rpcconnect=127.0.0.1"
		echo "bitcoin-rpcport=8332"
		echo "bitcoin-rpcuser=$bitcoin_rpc_user"
		echo "bitcoin-rpcpassword=$bitcoin_rpc_password"
		echo "addr=0.0.0.0:$(ynh_cln_setting p2p 9735)"
		if [ "$(ynh_cln_setting grpc_enabled false)" = "true" ]; then
			echo "grpc-port=$(ynh_cln_setting grpc_port 9736)"
		fi
	} > "$config_file"
	chown root:"$app" "$config_file"
	chmod 0640 "$config_file"
}

# Grants the "$app" group read access to the gRPC client certs CLN
# auto-generates under $data_dir/bitcoin/ once grpc-port is set, without
# loosening access to hsm_secret or anything else in that directory.
# Must run after lightningd has actually started with grpc enabled, since
# the certs don't exist until then.
ynh_cln_fix_grpc_cert_perms() {
	[ "$(ynh_cln_setting grpc_enabled false)" = "true" ] || return 0
	local cert_dir="$data_dir/bitcoin"
	local cert
	chmod 0710 "$data_dir" "$cert_dir" 2>/dev/null || true
	for cert in ca.pem client.pem client-key.pem; do
		[ -f "$cert_dir/$cert" ] && chmod 0640 "$cert_dir/$cert"
	done
	return 0
}

ynh_cln_unpack() {
	local archive="$install_dir/clightning.tar.xz"
	[ -f "$archive" ] || ynh_die "Core Lightning release archive was not found at $archive."
	tar -xJf "$archive" -C "$install_dir" --strip-components=2
	rm -f "$archive"
	[ -x "$lightningd_bin" ] || ynh_die "Core Lightning archive did not contain $lightningd_bin"
	[ -x "$lightning_cli" ] || ynh_die "Core Lightning archive did not contain $lightning_cli"
	# Keep the release owned by root while granting the service account's
	# group the read/execute access required by systemd.
	chown -R root:"$app" "$install_dir"
	chmod -R u=rwX,g=rX,o=--- "$install_dir"
}

ynh_cln_rpc() {
	"$lightning_cli" --lightning-dir="$data_dir" "$@"
}

ynh_cln_healthcheck() {
	ynh_cln_rpc getinfo >/dev/null
}

ynh_cln_wait_for_rpc() {
	local timeout="${1:-60}"
	local attempt
	for ((attempt = 1; attempt <= timeout; attempt++)); do
		if ynh_cln_healthcheck >/dev/null 2>&1; then
			return 0
		fi
		sleep 1
	done
	return 1
}

# Surfaces why lightningd never answered RPC, at WARNING level so it lands
# in the operation log rather than being swallowed. Call this right before
# ynh_die on a failed ynh_cln_wait_for_rpc.
ynh_cln_dump_diagnostics() {
	ynh_print_warn "--- Core Lightning diagnostics (systemctl status) ---"
	systemctl status "$service_name" --no-pager -l 2>&1 | while IFS= read -r line; do ynh_print_warn "$line"; done
	ynh_print_warn "--- Core Lightning diagnostics (lightningd.log tail) ---"
	if [ -r "$data_dir/bitcoin/lightningd.log" ]; then
		tail -n 60 "$data_dir/bitcoin/lightningd.log" 2>&1 | while IFS= read -r line; do ynh_print_warn "$line"; done
	else
		ynh_print_warn "$data_dir/bitcoin/lightningd.log not found or not readable"
	fi
	ynh_print_warn "--- Core Lightning diagnostics (bitcoind reachability) ---"
	if command -v curl >/dev/null 2>&1; then
		curl -s -u "$bitcoin_rpc_user:$bitcoin_rpc_password" --data-binary '{"jsonrpc":"1.0","id":"clncheck","method":"getblockchaininfo","params":[]}' -H 'content-type: text/plain;' http://127.0.0.1:8332/ 2>&1 | while IFS= read -r line; do ynh_print_warn "$line"; done
	fi
	ynh_print_warn "--- end Core Lightning diagnostics ---"
}
