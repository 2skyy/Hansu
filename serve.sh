#!/usr/bin/env bash
# 한수런런 로컬 개발 서버
#   ./serve.sh          기본 포트 8811
#   ./serve.sh 3000     포트 지정
set -euo pipefail

PORT="${1:-8811}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '')"

# 이미 그 포트를 쓰고 있으면 알려주고 멈춘다 (조용히 두 개 띄우면 헷갈린다)
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "⚠️  포트 $PORT 이미 사용 중입니다."
  echo "    끄려면: pkill -f \"http.server $PORT\""
  echo "    또는 다른 포트로: ./serve.sh 8812"
  exit 1
fi

echo ""
echo "  한수런런 로컬 서버"
echo "  ───────────────────────────────────────────────"
echo "  이 컴퓨터   http://localhost:$PORT/"
echo "  좌표 보정   http://localhost:$PORT/?geodebug=1"
if [ -n "$LAN_IP" ]; then
  echo "  같은 와이파이 http://$LAN_IP:$PORT/   (아래 주의 참고)"
fi
echo ""
echo "  ⚠️  스탬프 인증(위치 기능)은 보안 컨텍스트에서만 동작합니다."
echo "      localhost 는 예외로 허용되므로 이 컴퓨터에서는 잘 됩니다."
echo "      하지만 휴대폰에서 http://$LAN_IP 로 열면 브라우저가 위치를 차단합니다."
echo "      휴대폰 테스트가 필요하면 https 터널을 쓰세요:"
echo "        brew install cloudflared"
echo "        cloudflared tunnel --url http://localhost:$PORT"
echo ""
echo "  끄기: Ctrl+C"
echo "  ───────────────────────────────────────────────"
echo ""

cd "$DIR"
exec python3 -m http.server "$PORT" --bind 0.0.0.0
