#!/bin/bash
# Run as root on beartec-brain. Does not print secrets.
set -euo pipefail
SRC="${1:-/usr/local/src/falcon-fills-store}"
id -u falcon-fills >/dev/null 2>&1 || useradd --system --home-dir /var/lib/falcon-fills-store --shell /usr/sbin/nologin --user-group falcon-fills
install -d -o falcon-fills -g falcon-fills -m 750 /var/lib/falcon-fills-store
install -d -o falcon-fills -g falcon-fills -m 750 /var/lib/falcon-fills-store/backups
install -d -o root -g falcon-fills -m 750 /etc/falcon-fills-store
install -d -o root -g root -m 755 /usr/local/lib/falcon-fills-store
install -d -o root -g root -m 755 /usr/local/share/falcon-fills-store
install -m 755 "$SRC/collector.py" /usr/local/lib/falcon-fills-store/collector.py
install -m 755 "$SRC/sync_candles.py" /usr/local/lib/falcon-fills-store/sync_candles.py
install -m 644 "$SRC/candle_lib.py" /usr/local/lib/falcon-fills-store/candle_lib.py
install -m 755 "$SRC/backup.sh" /usr/local/lib/falcon-fills-store/backup.sh
install -m 644 "$SRC/README.md" /usr/local/share/falcon-fills-store/README.md
install -m 644 "$SRC/systemd/falcon-fills-store.service" /etc/systemd/system/falcon-fills-store.service
install -m 644 "$SRC/systemd/falcon-fills-store.timer" /etc/systemd/system/falcon-fills-store.timer
install -m 644 "$SRC/systemd/falcon-fills-backup.service" /etc/systemd/system/falcon-fills-backup.service
install -m 644 "$SRC/systemd/falcon-fills-backup.timer" /etc/systemd/system/falcon-fills-backup.timer
# env file: create empty placeholder if missing (key installed separately)
if [ ! -f /etc/falcon-fills-store/env ]; then
  umask 027
  touch /etc/falcon-fills-store/env
  chown root:falcon-fills /etc/falcon-fills-store/env
  chmod 640 /etc/falcon-fills-store/env
fi
systemctl daemon-reload
systemctl enable --now falcon-fills-store.timer
systemctl enable --now falcon-fills-backup.timer
echo "install_ok"
systemctl is-active falcon-fills-store.timer
systemctl is-enabled falcon-fills-store.timer
