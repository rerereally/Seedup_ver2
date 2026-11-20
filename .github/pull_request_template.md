## 무엇을 왜 바꿨나

-

<!-- 계획 칸(예: 단계 1 B1)이 있으면 적고, 없으면 지워도 됩니다. 바꾼 동작 때문에 틀려진 문서(status.md, README.md 등)도 같이 고쳤는지 적어 주세요. -->

## 확인한 것

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test` (Windows의 `prd-exports` 1개 실패는 정상, CONTRIBUTING.md 10절)
- [ ] 화면을 바꿨다면 직접 확인한 화면:

## 운영 DB 마이그레이션

- [ ] 없음
- [ ] 있음: 파일 `supabase/migrations/...`, `lib/schema-manifest.json` 재생성함. 머지한 사람이 머지 직후 운영에 적용하고 `check-schema`로 확인(CONTRIBUTING.md 7절)

## 공용 파일

- [ ] 건드리지 않음
- [ ] 건드림(상대에게 알림): `Header.tsx` / `schema-manifest.json` / `lib/llm.ts` / `lib/mcp/server.ts`
