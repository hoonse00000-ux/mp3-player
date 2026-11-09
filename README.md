# 내 음악 플레이어 🎵

휴대폰·컴퓨터 브라우저에서 바로 쓰는 MP3 플레이어 웹 앱입니다. 설치가 필요 없고, 파일 하나(`index.html`)로 동작합니다.

## 기능
- **MP3 저장** – 여러 곡을 한 번에 추가 (드래그 앤 드롭 지원), 브라우저(IndexedDB)에 저장
- **이름 바꾸기** – 곡·플레이리스트 이름 수정
- **플레이리스트** – 만들기, 곡 담기/빼기, 순서 바꾸기
- **반복 모드** – 순서대로 반복 / 한 곡 반복 / 반복 안 함
- **셔플 재생**
- **리믹스** – 나이트코어, 슬로우+리버브, 베이스 부스트, 에코, 콘서트홀 + 속도·베이스·리버브·에코 직접 조절
- **이어서 듣기** – 앱을 닫았다 열어도 마지막 곡·위치·설정 복원
- **백그라운드 재생 & 잠금화면 조작** (Media Session API)
- **로그인 & 계정 동기화** – 이메일 / Google 계정, 곡·이름·가사·플레이리스트를 계정에 저장해 다른 기기에서도 그대로 (Firebase Auth · Firestore · Storage)
- **곡 정보 자동 읽기** – MP3 태그의 제목·가수·앨범·앨범 사진, 파일 이름의 `[영상ID]` 꼬리표 자동 정리
- **검색 · 재생 시간 표시**
- **플레이리스트 끌어서 순서 바꾸기**
- **잠자기 타이머** – 15~90분 후 / 지금 곡이 끝나면
- **영상에서 음원 추출** – 영상 파일(MP4·MOV 등)의 소리만 뽑아 MP3로 변환해 바로 추가 (기기 안에서 처리, [lamejs](https://github.com/zhuker/lamejs) 사용 · LGPL)
- **MP3 파일로 저장**
- **가사** – MP3에 든 가사 자동 표시(USLT), 직접 쓰기·수정, `[00:12.34]` 시간 가사는 노래에 맞춰 따라감
- **앱처럼 설치 & 오프라인 실행** – 홈 화면 아이콘, 인터넷 없이도 열림 (PWA)

## 사용법
`index.html`을 브라우저로 열거나, GitHub Pages 주소로 접속하세요.

> 음악 파일은 각자 기기의 브라우저에만 저장되며, 서버로 업로드되지 않습니다.

## 계정 동기화 설정 (Firebase)
1. Firebase 콘솔에서 프로젝트를 **Blaze 요금제**로 업그레이드 (Storage 사용에 필요, 5GB까지 무료)
2. **Firestore Database** 만들기 → 규칙:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```
3. **Storage** 시작하기 (무료 구간: US-CENTRAL1 / US-EAST1 / US-WEST1) → 규칙:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{uid}/{allPaths=**} {
      allow read, delete: if request.auth != null && request.auth.uid == uid;
      allow write: if request.auth != null && request.auth.uid == uid && request.resource.size < 200 * 1024 * 1024;
    }
  }
}
```
4. Google Cloud Shell에서 CORS 설정 (브라우저에서 파일 받기용):
```
echo '[{"origin":["https://hoonse00000-ux.github.io"],"method":["GET"],"maxAgeSeconds":3600}]' > cors.json && gcloud storage buckets update gs://mp-3-e2ac0.firebasestorage.app --cors-file=cors.json
```
