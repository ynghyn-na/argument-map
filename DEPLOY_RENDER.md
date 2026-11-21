# Render 무료 배포

앱에는 사용자별 분석 횟수 제한을 두지 않습니다.
render.yaml은 웹 서비스 한 개를 plan: free로 생성합니다.
별도 데이터베이스나 유료 서비스는 생성하지 않습니다.

## 현재 서비스

- 공용 주소: https://argument-map-api.onrender.com
- 관리 화면: https://dashboard.render.com/web/srv-dc0lv2t9el5s73ehrdcg
- 작업 공간: Epoch's workspace
- 서버 플랜: Free, 싱가포르 리전
- 생성 방식: Render 웹 서비스 직접 생성
- 자동 배포: 꺼짐

2026-11-21 첫 배포가 live 상태에 도달한 것을 확인했습니다.
사용자별 분석 횟수 제한을 추가하지 않았습니다.
AI 분석을 시작하려면 관리자가 아래 API 키 설정을 완료해야 합니다.

### API 키 설정

1. 위 관리 화면에서 Environment를 엽니다.
2. OPENAI_API_KEY 환경 변수를 추가하고 사용할 전체 비밀키를 입력합니다.
3. Save, rebuild, and deploy를 선택합니다.
4. 새 배포가 Live가 된 뒤 https://argument-map-api.onrender.com/health 에서
   ok와 configured가 true인지 확인합니다.

OPENAI_MODEL은 이미 gpt-5-mini로 설정되어 있습니다.
실제 API 키와 .env 파일은 GitHub에 올리지 않습니다.
서버 호스팅은 무료 플랜이며 OpenAI API 사용료는 키 소유자 계정에 별도로 청구됩니다.

현재 서비스는 저장소 루트에서 다음 명령으로 실행됩니다.

    python -m pip install -r backend/requirements.txt
    uvicorn backend.server:app --host 0.0.0.0 --port $PORT --no-access-log

## 서버 만들기

1. 이 프로젝트의 backend, render.yaml, .python-version을 포함한 소스를 Git 저장소에 올립니다.
   실제 .env나 API 키를 저장소에 올리지 않습니다.
2. Render에서 Blueprint를 만들고 해당 저장소를 선택합니다.
3. 표시되는 웹 서비스의 플랜이 Free인지 확인합니다.
4. OPENAI_API_KEY 입력란에 사용할 전체 비밀키를 직접 입력합니다.
   값은 Render 환경 변수로 보관되며 확장 프로그램에는 포함하지 않습니다.
5. 배포 후 Render가 반환한 실제 HTTPS 서비스 주소를 확인합니다.

Blueprint를 사용하지 않고 Web Service로 만드는 경우:

| 설정 | 값 |
|---|---|
| Runtime | Python |
| Root Directory | backend |
| Build Command | python -m pip install -r requirements.txt |
| Start Command | uvicorn server:app --host 0.0.0.0 --port $PORT --no-access-log |
| Instance Type | Free |
| Health Check Path | /health |
| OPENAI_MODEL | gpt-5-mini |
| OPENAI_API_KEY | Render 환경 변수에서 직접 설정 |

Python 버전은 .python-version을 통해 3.12 계열을 사용합니다.

## 배포 확인

실제 서비스 주소 뒤에 /health를 붙여 확인합니다.
ok와 configured가 true이면 서버가 실행 중이며 키 설정이 존재합니다.
configured는 API 키의 유효성이나 결제 잔액까지 확인한 값은 아닙니다.
per_user_limits는 false입니다.

이 서버는 사용자 ID, IP, 쿠키를 이용한 분석 횟수 카운터를 두지 않습니다.
OpenAI 계정의 자체 한도나 무료 호스팅의 기본 자원 한도는 별도로 적용됩니다.

## 확장 프로그램 연결

원문 탭의 논증지도 패널에서 서버 연결 설정을 엽니다.
Render가 반환한 실제 HTTPS 주소를 저장하고 해당 주소의 접근 권한을 허용합니다.
이후에는 그 컴퓨터에서 Python을 실행할 필요가 없습니다.

다른 사용자에게 배포할 ZIP에 서버 주소를 미리 넣으려면 프로젝트 루트에서 실행합니다.
아래 REAL_SERVICE_URL은 배포 결과로 받은 주소로 바꿉니다.

    python tools/configure_cloud.py --server-url REAL_SERVICE_URL

이 명령은 공개 서버 주소를 config.js에 기록하고 그 서버에 대한 접근 권한을
manifest.json에 추가합니다. API 키를 확장 프로그램에 넣지 않습니다.

## 무료 서버의 절전

Render 무료 웹 서비스는 일정 시간 사용하지 않으면 절전 상태가 됩니다.
확장 프로그램은 공용 서버의 연결 확인을 최대 약 105초 동안 기다립니다.
이때 재시도하는 요청은 GET /health뿐입니다.
유료 AI 요청인 POST /analyze는 자동으로 재전송하지 않습니다.
사용자가 패널을 끄거나 다른 화면으로 이동하면 진행 중인 연결 대기를 중단합니다.

기존 로컬 서버를 계속 사용할 때는 서버 연결 설정에서 로컬 서버 사용을 선택합니다.

## 현재 배포 상태

무료 웹 서비스 생성과 첫 배포는 완료했습니다.
확장 프로그램에는 실제 공용 서버 주소를 기본값으로 반영했습니다.
API 키 설정과 실제 AI 분석 확인은 아직 남아 있습니다.

공식 안내:
https://render.com/docs/deploy-fastapi
https://render.com/docs/blueprint-spec
https://render.com/docs/free
