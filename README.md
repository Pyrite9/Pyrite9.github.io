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
| `data/projects.json` | 프로젝트 목록 |
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
| `summary_ko` / `summary_en` | | 한국어 설명 / 영어 보조 줄 |
| `stack` | | 기술 chip |
| `links` | | `repo`, `repo2`, `demo`, `booth`, `video` 중 아무 키. 빈 값은 무시 |
| `link_labels` | | 링크 글자를 키별로 바꿀 때 지정 |
| `image` | | 없으면 `null`. 이미지 없는 카드도 정상 표시, 파일이 없으면 이미지 영역만 빠짐. `width`/`height`는 실제 픽셀 크기 |
| `highlights_ko` | | 카드 안 bullet 목록 |

- 배열 순서 = 화면 순서
- 이미지는 `assets/`에 두고 수백 KB 이하로 유지
- JSON 문법 오류나 파일 읽기 실패 시 카드 자리에 안내 문구 표시. 수정 후 로컬 확인 권장

## 로컬에서 보기

`fetch`를 쓰므로 `file://`로 열면 목록이 안 뜸. 이 폴더에서 정적 서버 실행.

```bash
python -m http.server 8000
```

이후 <http://localhost:8000/> 접속.

## 이미지 출처

`assets/`의 이미지는 모두 본인 저장소에서 가져옴: `footprint-demo/docs/screenshots/`, `vrchat-*/docs/images/01_thumbnail.jpg`.
