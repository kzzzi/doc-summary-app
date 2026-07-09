# 문서 분석 데모 (AX 솔루션)

문서 유형(조사/통계, 업무 가이드, 기술/전략 등)을 자동으로 판단하고, 유형에 맞는 항목으로 분석 결과를 정리해주는 프로토타입입니다.

## 🔗 라이브 데모 (GitHub Pages)

**https://kzzzi.github.io/doc-summary-app/**

지정된 샘플 PDF 5건에 대한 분석 결과가 파일 안에 내장된 정적 데모입니다. 별도 서버나 API 키 없이 바로 동작합니다.

## 로컬 서버 실행 (Node.js)

`server/`, `public/` 아래의 Express 앱은 파일 업로드(PDF/DOCX/HWP/HWPX/TXT), 텍스트 추출, 등록된 샘플 문서 매칭 결과 반환, TXT/DOCX/PDF 다운로드를 지원합니다.

```bash
cd doc-summary-app
npm install
node server/server.js
```

브라우저에서 `http://localhost:4000` 접속.

> **PDF 다운로드 폰트 안내**: 저작권 문제로 맑은 고딕(malgun.ttf/malgunbd.ttf)은 저장소에 포함하지 않았습니다. 로컬에서 PDF 내보내기를 쓰려면 Windows의 `C:\Windows\Fonts\malgun.ttf`, `malgunbd.ttf`를 `server/assets/fonts/`에 직접 복사해주세요.

## 폴더 구조

- `server/` — Express 서버, 파일 파싱, 내보내기(TXT/DOCX/PDF) 로직
- `server/fixtures/` — 등록된 샘플 문서별 사전 계산 분석 결과 (길이별 3종: 짧게/보통/자세히)
- `public/` — 로컬 서버용 프론트엔드
- `docs/` — GitHub Pages용 정적 데모 (샘플 결과가 내장된 단일 HTML)
