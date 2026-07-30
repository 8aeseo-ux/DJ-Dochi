# DJ DOCHI

## 로컬 개발

AI Vision 이미지 추출과 취향 분석처럼 `/api` 아래의 Vercel Functions가 필요한 기능은 다음 명령으로 실행합니다.

```bash
pnpm dev:vercel
```

이 스크립트는 로컬의 `.env.local`을 함수 실행 환경에 불러온 뒤 Vercel 개발 서버를 시작합니다. 브라우저에서는 안내되는 `http://127.0.0.1:3001` 주소를 사용하세요. 내부 Vercel Functions 서버는 `http://127.0.0.1:3000`에서 실행됩니다.

`.env.local`에는 다음 환경변수가 필요합니다.

```dotenv
OPENAI_API_KEY=
OPENAI_VISION_MODEL=
OPENAI_MODEL=
LLM_PROVIDER=openai
```

`pnpm dev`는 순수 Vite UI 서버만 실행합니다. 이 모드에서는 `/api/extract-playlist`, `/api/generate-mixtape` 같은 Serverless Functions가 실행되지 않으므로 AI Vision과 취향 분석 기능이 작동하지 않습니다.

API 키는 브라우저 코드에 넣거나 저장소에 커밋하지 마세요.
