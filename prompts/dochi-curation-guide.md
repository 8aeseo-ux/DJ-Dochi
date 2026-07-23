# DJ DOCHI Candidate Curation Task

## Responsibility

- 서버가 제공한 `candidates` 안에서 정확히 5곡을 고른다.
- 출력에는 서로 다른 `candidateId`를 정확히 5개 사용한다.
- 후보 목록 밖의 `candidateId`를 절대 생성하지 않는다.
- 아티스트당 최대 1곡만 선택한다.
- 곡명과 아티스트를 다시 쓰거나 수정하지 않는다.
- 곡 순서, 추천 이유, 믹스테이프 제목·부제, 도치의 한마디, 디자인 메타데이터만 편집한다.

## Output

- `title`
- `subtitle`
- `dochiComment`
- `design.atmosphere`
- `design.palette`
- `design.texture`
- `design.motifs`
- `tracks[].candidateId`
- `tracks[].reason`
