#!/usr/bin/env bash
# setup-vps.sh
# XServer VPS (Ubuntu 22.04 LTS) 初期セットアップ
# 実行方法: bash setup-vps.sh <your-username>
# 例: bash setup-vps.sh deployer

set -euo pipefail

# ────────────────────────────────────────────────────────────
# 設定
# ────────────────────────────────────────────────────────────
DEPLOY_USER="${1:-deployer}"
NODE_VERSION="20"
PNPM_VERSION="9"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ────────────────────────────────────────────────────────────
# root チェック
# ────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  error "root で実行してください: sudo bash setup-vps.sh $DEPLOY_USER"
fi

info "==============================="
info " note-auto-publisher VPS setup"
info " デプロイユーザー: $DEPLOY_USER"
info "==============================="

# ────────────────────────────────────────────────────────────
# 1. システム更新
# ────────────────────────────────────────────────────────────
info "[1/7] システム更新..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget git unzip jq \
  ca-certificates gnupg lsb-release \
  ufw fail2ban

# ────────────────────────────────────────────────────────────
# 2. デプロイユーザー作成
# ────────────────────────────────────────────────────────────
info "[2/7] デプロイユーザー ($DEPLOY_USER) 作成..."
if id "$DEPLOY_USER" &>/dev/null; then
  warn "ユーザー $DEPLOY_USER は既に存在します。スキップ。"
else
  useradd -m -s /bin/bash -G sudo "$DEPLOY_USER"
  info "ユーザー $DEPLOY_USER を作成しました。"
fi

# SSH 公開鍵をデプロイユーザーへコピー（root の authorized_keys がある場合）
if [[ -f /root/.ssh/authorized_keys ]]; then
  AUTH_DIR="/home/$DEPLOY_USER/.ssh"
  mkdir -p "$AUTH_DIR"
  cp /root/.ssh/authorized_keys "$AUTH_DIR/authorized_keys"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$AUTH_DIR"
  chmod 700 "$AUTH_DIR"
  chmod 600 "$AUTH_DIR/authorized_keys"
  info "SSH 公開鍵を $DEPLOY_USER にコピーしました。"
fi

# ────────────────────────────────────────────────────────────
# 3. SSH ハードニング
# ────────────────────────────────────────────────────────────
info "[3/7] SSH セキュリティ設定..."
SSHD_CFG="/etc/ssh/sshd_config"

# バックアップ
cp "$SSHD_CFG" "${SSHD_CFG}.bak"

# パスワード認証を無効化・鍵認証のみ許可
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD_CFG"
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' "$SSHD_CFG"
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' "$SSHD_CFG"
sed -i 's/^#\?X11Forwarding.*/X11Forwarding no/' "$SSHD_CFG"

systemctl reload sshd
warn "SSH パスワード認証を無効化しました。鍵でのみログイン可能です。"

# ────────────────────────────────────────────────────────────
# 4. ファイアウォール (UFW)
# ────────────────────────────────────────────────────────────
info "[4/7] ファイアウォール設定..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
ufw --force enable
info "UFW: 22/80/443 のみ許可。"

# ────────────────────────────────────────────────────────────
# 5. Docker インストール
# ────────────────────────────────────────────────────────────
info "[5/7] Docker インストール..."
if command -v docker &>/dev/null; then
  warn "Docker は既にインストール済みです。スキップ。"
else
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq \
    docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin

  systemctl enable --now docker
fi

# デプロイユーザーを docker グループへ追加
usermod -aG docker "$DEPLOY_USER"
info "Docker インストール完了。$(docker --version)"

# ────────────────────────────────────────────────────────────
# 6. Node.js + pnpm インストール
# ────────────────────────────────────────────────────────────
info "[6/7] Node.js $NODE_VERSION + pnpm $PNPM_VERSION インストール..."
if command -v node &>/dev/null; then
  warn "Node.js は既にインストール済みです ($(node --version))。スキップ。"
else
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  apt-get install -y -qq nodejs
  info "Node.js インストール完了。$(node --version)"
fi

if command -v pnpm &>/dev/null; then
  warn "pnpm は既にインストール済みです ($(pnpm --version))。スキップ。"
else
  npm install -g "pnpm@$PNPM_VERSION"
  info "pnpm インストール完了。$(pnpm --version)"
fi

# ────────────────────────────────────────────────────────────
# 7. fail2ban 有効化
# ────────────────────────────────────────────────────────────
info "[7/7] fail2ban (SSH ブルートフォース対策) 有効化..."
systemctl enable --now fail2ban

# ────────────────────────────────────────────────────────────
# 完了サマリー
# ────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}===============================${NC}"
echo -e "${GREEN} セットアップ完了！${NC}"
echo -e "${GREEN}===============================${NC}"
echo ""
echo "  デプロイユーザー : $DEPLOY_USER"
echo "  Docker           : $(docker --version)"
echo "  Node.js          : $(node --version)"
echo "  pnpm             : $(pnpm --version)"
echo ""
echo -e "${YELLOW}【次のステップ】${NC}"
echo "  1. 別ターミナルで鍵認証ログインを確認してから root を締める"
echo "     ssh $DEPLOY_USER@<VPS_IP>"
echo "  2. /home/$DEPLOY_USER にプロジェクトを clone して .env を配置"
echo "  3. docker compose up -d で起動"
echo ""
