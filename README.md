# 논증지도 0.3.0 — 공용 서버 연결 지원

Chrome의 논증지도 아이콘이 켜기/끄기 버튼입니다. 켜면 현재 보이는 웹페이지
전체를 캡처해 자동으로 분석하고, 브라우저 오른쪽 패널에 지도를 표시합니다.
영역을 드래그하거나 분석 시작 버튼을 따로 누를 필요가 없습니다.
지도 생성에는 API 응답 시간이 필요합니다.

Chrome 142 이상을 사용하세요. 공용 서버를 이용하면 Python 설치나
PowerShell 서버 실행이 필요하지 않습니다. 로컬 서버를 직접 실행할 때만
Python 3.11 이상이 필요합니다.

## 배포된 공용 서버로 사용하기

서버 주소: https://argument-map-api.onrender.com

1. 이 저장소에서 Code → Download ZIP을 선택하고 압축을 풉니다.
2. Chrome 주소창에 chrome://extensions 를 입력하고 개발자 모드를 켭니다.
3. 압축해제된 확장 프로그램을 로드합니다를 누르고 extension 폴더를 선택합니다.
   이미 설치했다면 기존 extension 폴더를 새 파일로 교체하고 확장 프로그램을 새로고침합니다.
4. 읽을 글이 있는 탭에서 논증지도 확장 아이콘을 누릅니다.

이 배포본에는 공용 서버 주소가 기본값으로 들어 있습니다.
서버 연결 설정에서 주소를 직접 저장한 적이 있다면 위 주소로 바꾸고 저장합니다.
각 사용자 컴퓨터에서 서버를 실행하거나 API 키를 입력할 필요가 없습니다.

서버 관리자: Render에서 OPENAI_API_KEY를 설정한 뒤 분석을 사용할 수 있습니다.
키 설정 전에는 확장 프로그램에 서버 관리자에게 설정을 요청하라는 안내가 표시됩니다.
API 키는 Render 환경 변수에만 입력하고 저장소나 확장 프로그램에는 넣지 않습니다.

## 서버 관리와 새 배포

render.yaml에 Render 무료 웹 서비스 배포 설정을 포함했습니다.
사용자별 분석 횟수 제한이나 카운터를 추가하지 않았습니다.
상세한 배포 과정은 DEPLOY_RENDER.md를 따릅니다.

확장 프로그램은 서버 연결 설정에서 공용 HTTPS 서버 주소를 저장할 수 있습니다.
관리자가 실제 배포 URL을 config.js에 미리 넣은 배포본을 제공하면 사용자는
확장 프로그램만 설치해 사용할 수 있습니다. API 키는 서버에서만 관리합니다.

무료 서버의 절전 해제를 기다리며 연결 확인만 재시도합니다.
AI 분석 요청은 자동으로 중복 전송하지 않습니다.
기존 로컬 서버 방식도 계속 사용할 수 있습니다.

## 0.2.0에서 캡처 권한 오류가 발생했다면

이전 버전은 사이드패널이 열리는 이벤트에서 바로 캡처를 시작해,
현재 탭의 activeTab 권한이 없는 상태에서도 캡처를 요청할 수 있었습니다.
0.2.1은 상단 확장 아이콘의 실행 이벤트에서 권한을 받고 분석을 시작합니다.
사이트 전체에 접근하는 추가 권한을 요청하지 않습니다.

1. 논증지도 패널을 닫습니다. PowerShell 서버는 실행 중인 상태로 둡니다.
2. ZIP의 argument-map-chrome 안에 있는 extension 폴더 전체를
   C:\ArgumentMap\extension에 덮어씁니다. manifest.json과 background.js도 함께 교체합니다.
3. chrome://extensions 에서 논증지도 카드의 새로고침 버튼을 누릅니다.
4. 카드 또는 패널 상단에서 버전 0.3.0을 확인합니다.
5. 원문이 있는 탭에서 Chrome 상단의 논증지도 확장 아이콘을 누릅니다.

이 수정에서는 backend와 .env를 바꿀 필요가 없습니다.
Chrome의 사이드패널 목록에서 직접 패널만 열었을 때는 상단 아이콘으로
켜라는 안내가 표시됩니다. 원문 탭에서 확장 아이콘을 실행해야 캡처 권한이 생깁니다.

## 이미 0.1 버전을 설치했다면

1. 실행 중인 서버 창에서 Ctrl+C를 눌러 서버를 종료합니다.
2. ZIP 안의 argument-map-chrome 폴더를 엽니다.
3. 그 안의 extension 폴더와 backend/server.py를 기존 C:\ArgumentMap 위치에
   덮어씁니다. 기존 폴더를 통째로 삭제하지 마세요.
   backend/.env와 .venv는 계속 사용합니다. 이 ZIP에는 실제 .env가 없습니다.
4. PowerShell에서 서버를 다시 실행합니다.

       cd C:\ArgumentMap
       .\.venv\Scripts\python.exe .\backend\server.py

5. Chrome 주소창에 chrome://extensions 를 입력하고 기존 논증지도의
   새로고침 버튼을 누릅니다.
6. 읽을 글로 돌아와 상단 논증지도 아이콘을 누릅니다.

의존성은 이전 버전과 같아서 이미 설치했다면 pip 설치를 반복하지 않아도 됩니다.

## 로컬 서버를 처음 설치한다면 (선택)

압축을 푼 뒤 argument-map-chrome 안의 backend, extension, start_server.bat,
README.md를 C:\ArgumentMap 안에 넣습니다. backend가 C:\ArgumentMap 바로 아래에
있어야 아래 명령을 그대로 쓸 수 있습니다.

PowerShell에서 한 줄씩 실행합니다.

    cd C:\ArgumentMap
    py -m venv .venv
    .\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt
    Copy-Item .\backend\.env.example .\backend\.env
    notepad .\backend\.env

OPENAI_API_KEY의 YOUR_API_KEY를 생성할 때 복사한 전체 비밀키로 바꿉니다.
대시보드의 추적 ID나 생략 표시된 비밀키는 인증에 사용할 수 없습니다.
OPENAI_MODEL은 기존 gpt-5-mini를 사용합니다.

    OPENAI_API_KEY=전체_비밀키
    OPENAI_MODEL=gpt-5-mini

키 생성: https://platform.openai.com/api-keys

API 키를 수정한 뒤에는 서버를 다시 실행하세요.

    .\.venv\Scripts\python.exe .\backend\server.py

이후에는 start_server.bat을 더블클릭해도 됩니다. 서버 창은 사용하는 동안
열어 둡니다. http://127.0.0.1:8765/health 에서 서버 상태를 볼 수 있습니다.
configured는 키 설정이 있다는 뜻이며, 유효성이나 잔액을 확인한 값은 아닙니다.

Chrome 주소창에 chrome://extensions 를 입력하고 개발자 모드를 켭니다.
압축해제된 확장 프로그램을 로드합니다를 누르고 C:\ArgumentMap\extension을
선택합니다. 퍼즐 메뉴에서 논증지도를 고정하면 상단에 아이콘이 표시됩니다.

## 사용

- 켜기: 읽을 글이 있는 탭에서 상단 논증지도 아이콘을 누릅니다.
  영역 선택 없이 자동 분석을 시작합니다.
- 끄기: 같은 아이콘을 다시 누르거나 패널 오른쪽 위의 토글을 누릅니다.
  패널의 × 버튼으로 닫아도 꺼집니다.
- 갱신: 원문을 스크롤하거나 확대하고 현재 화면 다시 분석을 누릅니다.
- 원문 확인: 지도 상자를 누르면 관련 인용문과 인식한 원문을 볼 수 있습니다.
- 저장: SVG 저장 또는 PNG 저장을 누릅니다.
- 예시: 예시 지도 보기는 미리 작성한 가상 데이터를 표시하며 API를 호출하지 않습니다.

분석 범위는 현재 보이는 탭의 웹페이지 영역입니다. 데스크톱 전체나
스크롤 아래의 페이지 전체를 이어 붙여 캡처하지 않습니다. 기본적으로
메뉴와 광고보다 화면 속 본문을 우선해 분석합니다.

패널을 열면 원문 화면의 가로폭이 조정되며, 조정 후 보이는 화면을 캡처합니다.
패널 폭에 맞춰 지도 상자를 배치하므로 작은 글씨로 전체 지도를 축소할 필요가
없습니다. 지도가 길면 패널 안에서 스크롤하세요.

켜기와 다시 분석을 누를 때마다 화면이 OpenAI API로 전송되며 사용량에 따라
API 요금이 발생할 수 있습니다. 스크롤, 탭 전환, 페이지 이동만으로는 추가
분석을 요청하지 않습니다. 탭이나 페이지가 바뀌면 이전 결과라는 표시가 나옵니다.
창마다 지도를 따로 관리하며, 끄거나 페이지가 바뀐 뒤에는 늦게 도착한 결과를
표시하지 않습니다. 이미 API로 전송된 요청의 처리나 요금까지 취소하는 것은 아닙니다.

새 탭에서 다시 분석 시 캡처 권한 오류가 나면 그 탭에서 상단 아이콘을
껐다 켜세요. 로컬 PDF 등 파일을 볼 때는 확장 프로그램 설정에서
파일 URL에 대한 액세스 허용이 필요할 수 있습니다.

## 연결이나 분석 오류

- 서버 연결 실패: 서버 창을 열고 연결 확인 또는 현재 화면 다시 분석을 누릅니다.
- API 키 오류: backend/.env에 실제 전체 비밀키를 넣고 서버를 다시 실행합니다.
  파일이 .env.txt가 아닌지 확인합니다.
- API 크레딧 부족: API 결제 설정에서 잔액을 확인합니다.
- API 사용/지출 한도 초과: 해당 조직과 프로젝트의 한도 설정을 확인합니다.
- 일시적 요청 제한: 잠시 기다린 뒤 현재 화면 다시 분석을 누릅니다.
- 권한 오류: API 키의 권한과 프로젝트의 모델 접근 권한을 확인합니다.
- 글자를 읽기 어려움: 원문을 확대하거나 본문 중심으로 스크롤한 뒤 다시 분석합니다.
- 주장을 찾지 못함: 주장과 근거가 포함된 본문이 화면에 보이도록 조정합니다.

API 결제 설정:
https://platform.openai.com/settings/organization/billing/overview

## 검증 범위

JavaScript/Python 구문과 매니페스트 경로를 확인했습니다. 브라우저 API를 모사한
자동 검사로 켜기/끄기, 한 번만 분석하기, 빠른 중복 클릭, 여러 창, 새로고침,
분석 중 닫기, 탭 이동 후 늦은 응답 폐기, 오류 표시를 확인했습니다.
실제 HTML과 지도 렌더러를 사용해 좁은 패널의 상자 배치, 원문 강조,
SVG/PNG 저장도 검사했습니다.

0.2.1에서는 권한을 부여하지 않고 사이드패널만 여는 상황으로
이전 버전의 영문 캡처 권한 오류를 재현했습니다. 같은 조건에서 새 버전이
권한 없는 캡처를 시도하지 않는지, 상단 아이콘 실행으로 권한을 받은 뒤
캡처가 되는지, ON/OFF, 빠른 반복 클릭, 탭 전환과 워커 재시작 이후에도
상태가 유지되는지를 모의 Chrome 환경에서 검사했습니다.

이 개발 환경에서는 Chromium이 운영 환경의 소켓 제한으로 실행되지 않아,
Chrome 도구 모음과 실제 사이드패널의 동작은 사용자 PC에서 확인해야 합니다.
실제 API 키를 사용하는 유료 호출도 실행하지 않았습니다.

## 공식 문서

Chrome 사이드패널:
https://developer.chrome.com/docs/extensions/reference/api/sidePanel

Chrome 현재 화면 캡처:
https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab

OpenAI 이미지 입력:
https://developers.openai.com/api/docs/guides/images-vision

OpenAI 구조화된 출력:
https://developers.openai.com/api/docs/guides/structured-outputs

OpenAI 오류 코드:
https://developers.openai.com/api/docs/guides/error-codes
