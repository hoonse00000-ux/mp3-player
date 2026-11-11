#!/bin/sh
# 배포 전에 실행: 앱 버전을 지금 시각으로 바꿔서, 설치된 앱이 새 버전을 알아채게 함
V=$(date -u +%Y%m%d%H%M%S)
sed -i "s/window.APP_VERSION = '[^']*';/window.APP_VERSION = '$V';/" index.html
printf '{ "v": "%s" }\n' "$V" > version.json
echo "version $V"
