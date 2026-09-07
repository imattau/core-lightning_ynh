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
bitcoin_data_dir="$(ynh_app_setting_get --app="$bitcoin_app" --key=data_dir 2>/dev/null || true)"
bitcoin_cli="$(ynh_app_setting_get --app="$bitcoin_app" --key=install_dir 2>/dev/null || true)/bitcoin-31.1/bin/bitcoin-cli"

ynh_cln_setting() {
	local key="$1" default="$2" value
	value="$(ynh_app_setting_get --app="$app" --key="$key" 2>/dev/null || true)"
	printf '%s' "${value:-$default}"
}

ynh_cln_require_bitcoin_app() {
	if ! yunohost app list 2>/dev/null | grep -q '^  - bitcoin_core:'; then
		ynh_die "Core Lightning requires a Bitcoin backend. Install Bitcoin Core for YunoHost first."
	fi
	[ -r "$bitcoin_config_file" ] || ynh_die "Bitcoin Core was detected, but $bitcoin_config_file is not readable."
	[ -n "$bitcoin_data_dir" ] || ynh_die "Bitcoin Core data directory could not be discovered."
}

ynh_cln_read_bitcoin_rpc_credentials() {
	bitcoin_rpc_user="$(sed -n -E 's/^rpcuser=([^[:space:]]+)$/\1/p' "$bitcoin_config_file" | tail -n1)"
	bitcoin_rpc_password="$(sed -n -E 's/^rpcpassword=([^[:space:]]+)$/\1/p' "$bitcoin_config_file" | tail -n1)"
	if [ -z "$bitcoin_rpc_user" ] || [ -z "$bitcoin_rpc_password" ]; then
		ynh_die "Bitcoin Core is installed, but bitcoin-core_ynh has not provisioned a restricted Core Lightning RPC credential yet. Refusing to grant CLN broad access to Bitcoin Core's cookie; see doc/BITCOIN_BACKEND.md."
	fi
}

ynh_cln_write_config() {
	mkdir -p "$config_dir"
	{
		echo "# Managed by YunoHost package $app. Edit through the config panel when possible."
		echo "network=$network"
		echo "alias=$(ynh_cln_setting alias 'My YunoHost Lightning Node')"
		echo "lightning-dir=$data_dir/bitcoin"
		echo "rpc-file=$data_dir/bitcoin/lightning-rpc"
		echo "log-file=$data_dir/bitcoin/lightningd.log"
		echo "log-level=$(ynh_cln_setting log_level info)"
	echo "bitcoin-rpcconnect=127.0.0.1"
		echo "bitcoin-rpcport=8332"
		echo "bitcoin-rpcuser=$bitcoin_rpc_user"
		echo "bitcoin-rpcpassword=$bitcoin_rpc_password"
		echo "addr=0.0.0.0:$(ynh_app_setting_get --app="$app" --key=p2p 2>/dev/null || echo 9735)"
	} > "$config_file"
	chown root:"$app" "$config_file"
	chmod 0640 "$config_file"
}

ynh_cln_unpack() {
	local archive
	archive="$(find "$install_dir" -maxdepth 1 -type f -name 'clightning-*.tar.xz' -print -quit)"
	[ -n "$archive" ] || ynh_die "Core Lightning release archive was not found."
	tar -xJf "$archive" -C "$install_dir" --strip-components=2
	rm -f "$archive"
	[ -x "$lightningd_bin" ] || ynh_die "Core Lightning archive did not contain $lightningd_bin"
	[ -x "$lightning_cli" ] || ynh_die "Core Lightning archive did not contain $lightning_cli"
	chown -R root:root "$install_dir"
	chmod -R o-rwx "$install_dir"
}

ynh_cln_rpc() {
	"$lightning_cli" --lightning-dir="$data_dir/bitcoin" "$@"
}

ynh_cln_healthcheck() {
	ynh_cln_rpc getinfo >/dev/null
}
