# 호스팅 위치 비교

작성일 2026-11-18. [service-plan.md](service-plan.md) 9절 1단계 6-1번 "네트워크 경로 결정"을 위한 자료입니다. 결정은 비용이 드는 일이라 사용자가 합니다.

## 1. 지금 구조와 실측

- **사이트:** Cloudflare Workers(무료 요금제), OpenNext. `wrangler.jsonc`의 `placement`가 `aws:us-east-1`이라, 화면을 만드는 코드는 미국 동부 근처에서 돕니다(DB와 가깝게 두려는 설정으로 보입니다).
- **DB:** Supabase. 지역은 로컬에서 확인하지 못했습니다. 위 설정으로 보아 미국 동부(us-east-1)일 가능성이 큽니다.
- **한국에서 잰 값(2026-11-18):**

| 항목 | 값 |
|---|---|
| 연결된 Cloudflare 거점 | 홍콩(HKG), 로스앤젤레스(LAX). 서울(ICN)은 한 번도 아님 |
| TCP 연결 | 0.15~0.22초 |
| TLS까지 | 약 0.4초 |
| 첫 응답 | 정적 파일(favicon) 0.85초, 화면 0.75~0.84초 |

정적 파일과 화면이 거의 같으므로, 지금 느린 주원인은 한국에서 Cloudflare 거점까지의 거리입니다. 화면을 만드는 시간은 상대적으로 작습니다.

## 2. 왜 서울로 안 가나

Cloudflare 커뮤니티에 같은 문제가 많이 올라와 있습니다. 한국 접속이 서울 대신 홍콩, 도쿄, 미국(LAX, SJC, SEA)으로 연결됩니다.

- 통신사 하나의 문제가 아닙니다. LG U+, KT에서 모두 같은 현상이 보고됐습니다.
- Pro 요금제와 Argo Smart Routing을 켜도 바뀌지 않았다는 보고가 있습니다. Argo는 Cloudflare와 원본 서버 사이 구간만 빠르게 합니다.
- 커뮤니티 답변의 설명은, 한국 통신사와의 연결 비용이 높아 낮은 요금제 IP는 서울 거점에서 광고하지 않는다는 것입니다. 공식 문서로는 확인하지 못했습니다.

출처: [Cloudflare Community 1](https://community.cloudflare.com/t/korean-visitors-routed-to-lax-sjc-sea-instead-of-icn-free-plan-origin-in-seoul/962794), [2](https://community.cloudflare.com/t/korean-visitor-traffic-consistently-routed-away-from-icn-seoul-to-distant-pops-h/961652), [3](https://community.cloudflare.com/t/zone-consistently-routed-to-lax-sjc-instead-of-icn-for-korean-traffic-argo-made-n/950006), [KT와 workers.dev](https://community.cloudflare.com/t/kt-korea-traffic-to-workers-dev-routes-through-lax-instead-of-icn/979412)

## 3. 선택지

| 선택지 | 바뀌는 것 | 비용 | 효과 | 위험 |
|---|---|---|---|---|
| **A. 그대로 두고 줄이기** | 화면 간 이동에서 요청 수 줄이기, 로그인 안 한 화면 캐시, 미리 불러오기 | 0 | 첫 접속은 그대로 0.8초 안팎. 사이트 안에서 이동할 때는 연결을 다시 쓰므로 체감이 줄어듦 | 없음 |
| B. Cloudflare Pro | 요금제만 | 월 20달러 | 서울 연결이 된다는 보장 없음. 효과 없었다는 보고가 있음 | 돈만 쓸 수 있음 |
| C. Cloudflare 상위 요금제(Business, Enterprise) | 요금제 | 월 수백 달러 이상 | 서울 연결 가능성이 높아짐 | 지금 규모에 비해 비쌈 |
| **D. Vercel로 옮기기** | 호스팅 전체. Vercel은 서울(icn1)에 거점과 함수 지역이 있음 | 상업용은 Pro 월 20달러(멤버당)부터 | 첫 연결이 서울 거점으로 갈 가능성이 큼(직접 재 봐야 함) | 배포 설정, 환경 변수, 크론 다시 구성. 함수 지역을 DB 근처로 둬야 함 |
| E. D + Supabase를 서울로 | DB 새 프로젝트로 옮기기 | Supabase 요금은 같음 | 화면을 만드는 시간까지 줄어듦 | 큼. 새 프로젝트를 만들고 데이터를 옮겨야 하며, 주소와 키, 로그인 콜백 주소가 모두 바뀜 |

출처: [Vercel 지역](https://vercel.com/docs/regions), [Vercel 서울 가격](https://vercel.com/docs/pricing/regional-pricing/icn1), [Supabase 지역 변경](https://supabase.com/docs/guides/troubleshooting/change-project-region-eWJo5Z)

## 4. 제안

1. **지금은 A를 합니다.** 비용이 없고, 사용자가 아직 거의 없어서 첫 접속 0.8초가 가장 큰 문제는 아닙니다.
2. **D는 재 보고 결정합니다.** 같은 코드를 Vercel 미리보기로 하나 올려, 한국에서 첫 응답을 같은 방법으로 잽니다. 0.3초 근처로 떨어지면 옮길 가치가 있습니다.
3. **E는 사용자가 생기고, 로그인한 화면의 서버 시간이 문제로 보일 때** 합니다. 관리자 화면의 사용 지표와 Cloudflare 로그로 판단합니다.
4. B는 권하지 않습니다.

## 5. 확인하지 못한 것

- Supabase 프로젝트의 실제 지역
- Vercel로 옮겼을 때의 실제 한국 응답 시간
- 통신사별 차이(이번 측정은 한 회선)
