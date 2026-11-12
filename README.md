# Pyrite9.github.io

김동건(KIM DONGGUN, Pyrite9)의 포트폴리오 사이트. <https://pyrite9.github.io/>

- vanilla HTML / CSS / JS. 빌드 단계, CDN, 외부 폰트, 외부 라이브러리 없음
- 이 폴더를 그대로 GitHub Pages 루트에 올리면 동작(모든 경로는 상대 경로)
- light / dark: 기본은 시스템 설정 따름. 헤더 버튼으로 바꾸면 `localStorage`(`color-scheme`)에 저장, 시스템과 같은 쪽으로 되돌리면 저장값 삭제

## 파일

| 파일 | 내용 |
|---|---|
| `index.html` | 본문 (Hero, About, Projects, Skills, Experience, Certifications, Contact) |
| `style.css` | 스타일, light/dark 토큰 |
| `script.js` | 테마 토글, `data/projects.json` 읽어서 카드 렌더링, 축 필터 |
| `swarm.js` / `swarm.css` | 스크롤 시 여러 커서가 블록을 "짓는" 빌드 애니메이션. JS 없음·`prefers-reduced-motion: reduce`·건너뛰기 선택(`localStorage` `swarm=off`) 시 동작 안 함. footer 버튼으로 다시 켜기 |
| `data/projects.json` | 프로젝트 목록 |
| `data/booth.json` | BOOTH 하트(위시리스트) 수. GitHub Actions가 갱신, 손으로 고치지 않음 |
| `scripts/update-booth.mjs` | `booth.json` 갱신 스크립트 (Node 18+, 표준 기능만) |
| `.github/workflows/booth-hearts.yml` | 6시간마다 갱신 스크립트 실행 |
| `assets/` | 프로젝트 이미지 |

## 프로젝트 추가

`data/projects.json` 배열에 항목 하나 추가. HTML 수정 불필요.

```json
{
  "id": "my-new-project",
  "track": "backend",
  "title": "프로젝트 이름",
  "summary_ko": "한국어 한두 문장 설명",
  "summary_en": "One-line English summary",
  "stack": ["Spring Boot 3", "PostgreSQL"],
  "links": {
    "repo": "https://github.com/Pyrite9/my-new-project",
    "demo": "https://example.com",
    "booth": "https://pyrite9.booth.pm/items/...",
    "video": "https://youtu.be/..."
  },
  "link_labels": { "demo": "명세서 Spec" },
  "image": { "src": "assets/my-new-project.png", "width": 1280, "height": 800, "alt": "화면 설명" },
  "highlights_ko": ["핵심 포인트 1", "핵심 포인트 2"]
}
```

| 필드 | 필수 | 설명 |
|---|---|---|
| `id` | O | 겹치지 않는 식별자 |
| `track` | O | `backend`, `vrchat`, `tools` 중 하나. `tools`는 카드가 아니라 아래쪽 짧은 목록으로 표시 |
| `title` | O | 카드 제목 |
| `published_at` | | BOOTH 공개일 `YYYY-MM-DD`. `vrchat` 축은 이 값의 최신순으로 정렬(값 없으면 뒤로). 화면에는 표시 안 함 |
| `summary_ko` / `summary_en` | | 한국어 설명 / 영어 보조 줄 |
| `stack` | | 기술 chip |
| `links` | | `repo`, `repo2`, `demo`, `booth`, `video` 중 아무 키. 빈 값은 무시 |
| `link_labels` | | 링크 글자를 키별로 바꿀 때 지정 |
| `image` | | 없으면 `null`. 이미지 없는 카드도 정상 표시, 파일이 없으면 이미지 영역만 빠짐. `width`/`height`는 실제 픽셀 크기 |
| `highlights_ko` | | 카드 안 bullet 목록 |

- 배열 순서 = 화면 순서 (`vrchat` 축만 `published_at` 최신순)
- 이미지는 `assets/`에 두고 수백 KB 이하로 유지
- JSON 문법 오류나 파일 읽기 실패 시 카드 자리에 안내 문구 표시. 수정 후 로컬 확인 권장

## BOOTH 하트 수 자동 갱신

- 동작: workflow가 6시간마다(UTC 기준 매 6시간 17분) `scripts/update-booth.mjs` 실행 → 값이 바뀌었을 때만 `data/booth.json`을 `github-actions[bot]` 이름으로 commit·push
- 대상: `data/projects.json`의 `links.booth`에 있는 모든 상품. 상품 추가 시 스크립트 수정 불필요
- 데이터 출처: `https://booth.pm/ko/items/<id>.json`의 `wish_lists_count`. 공식 문서화된 API가 아니라 형식 변경·차단 가능성 있음
- 안전장치
  - 요청 사이 1.5초 간격
  - 실패, 비정상 응답, 숫자가 아닌 값인 상품은 기존 값 유지
  - 전부 실패하면 파일을 건드리지 않고 workflow 실패로 종료
  - 값 변화가 없으면 commit 없음(`updated_at`도 값이 바뀔 때만 갱신)
- 화면: VRChat 카드마다 하트 수, VRChat 제목 옆에 합계. 마지막 갱신 시각은 마우스를 올리면 보이는 `title`. `booth.json`이 없거나 읽지 못하면 하트 표시만 빠짐
- 수동 실행
  - GitHub: repo의 Actions 탭 → "Update BOOTH hearts" → Run workflow
  - 로컬: 이 폴더에서 `node scripts/update-booth.mjs` (테스트용 경로 지정: `--projects <파일> --out <파일>`)
- 주의: public repo에서 60일간 활동(commit 등)이 없으면 GitHub가 schedule workflow를 자동으로 끔. 그때는 Actions 탭에서 다시 Enable

## 로컬에서 보기

`fetch`를 쓰므로 `file://`로 열면 목록이 안 뜸. 이 폴더에서 정적 서버 실행.

```bash
python -m http.server 8000
```

이후 <http://localhost:8000/> 접속.

## 이미지 출처

`assets/`의 이미지는 모두 본인 저장소·상품 페이지에서 가져옴: `footprint-demo/docs/screenshots/`, `vrchat-*/docs/images/01_thumbnail.jpg`, `sleeve-roll.jpg`(BOOTH 상품 대표 이미지).
