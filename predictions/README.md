# 봉인 예측

`npm run seal`은 저장된 스냅샷에서 기준을 통과한 기회를 찾아 `sealed.jsonl` 끝에 추가합니다. 이미 봉인한 기회는 건너뜁니다. 봉인 시점을 제3자가 확인할 수 있게 저장소에 공개하세요.

해시는 아래 순서로 만든 JSON을 UTF-8로 인코딩해 계산합니다. 키 사이에 공백을 넣지 않고, 끝에 줄바꿈을 붙이지 않습니다.

```sh
node -e 'const {createHash}=require("node:crypto"); const fs=require("node:fs"); for (const line of fs.readFileSync("predictions/sealed.jsonl", "utf8").trim().split("\n").filter(Boolean)) { const {slug,name,claim,withinDays,evidenceCount,platformCount,directCount,sealedAt,hash}=JSON.parse(line); const json=JSON.stringify({slug,name,claim,withinDays,evidenceCount,platformCount,directCount,sealedAt}); if (createHash("sha256").update(json,"utf8").digest("hex")!==hash) throw Error(slug); console.log(slug,hash); }'
```

봉인 시각보다 늦고 기한까지 출시된 직접 도구가 기록에 있으면 적중입니다. 최신 수집 시점이 기한에 이르기 전에는 기다리고, 기한까지 도구가 확인되지 않으면 빗나감으로 표시합니다.
