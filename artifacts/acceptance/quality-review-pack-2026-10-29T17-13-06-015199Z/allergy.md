# 过敏与忌口：待独立审核

所有标签仍为候选；本材料没有生成审核人名或批准结论。

## allergy-001

簇：`allergy:beef`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "牛肉",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "beef",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-2230dd694800796b",
      "variantId": "gallery-2230dd694800796b-r265"
    },
    {
      "recipeId": "gallery-4992d3405148ca4f",
      "variantId": "gallery-4992d3405148ca4f-r260"
    },
    {
      "recipeId": "gallery-59925e317ca052de",
      "variantId": "gallery-59925e317ca052de-r193"
    },
    {
      "recipeId": "gallery-74cfb6f634d00040",
      "variantId": "gallery-74cfb6f634d00040-r164"
    },
    {
      "recipeId": "gallery-75f3f3b97736c4af",
      "variantId": "gallery-75f3f3b97736c4af-r146"
    },
    {
      "recipeId": "gallery-8175c3f8232925c7",
      "variantId": "gallery-8175c3f8232925c7-r028"
    },
    {
      "recipeId": "gallery-92c6e9ce6eb11d6c",
      "variantId": "gallery-92c6e9ce6eb11d6c-r136"
    },
    {
      "recipeId": "gallery-9710fdd58d16a0a8",
      "variantId": "gallery-9710fdd58d16a0a8-r016"
    },
    {
      "recipeId": "gallery-b7faa43f6a1cdf48",
      "variantId": "gallery-b7faa43f6a1cdf48-r300"
    },
    {
      "recipeId": "gallery-cad3b9bd9c2b4acd",
      "variantId": "gallery-cad3b9bd9c2b4acd-r169"
    },
    {
      "recipeId": "gallery-e5c0fc95d63477e7",
      "variantId": "gallery-e5c0fc95d63477e7-r377"
    },
    {
      "recipeId": "gallery-e5fa34b9ae91b2f5",
      "variantId": "gallery-e5fa34b9ae91b2f5-r213"
    },
    {
      "recipeId": "gallery-f6a434fafd7fda90",
      "variantId": "gallery-f6a434fafd7fda90-r211"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-002

簇：`allergy:beef`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "牛肉",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "beef",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-2230dd694800796b",
      "variantId": "gallery-2230dd694800796b-r265"
    },
    {
      "recipeId": "gallery-4992d3405148ca4f",
      "variantId": "gallery-4992d3405148ca4f-r260"
    },
    {
      "recipeId": "gallery-59925e317ca052de",
      "variantId": "gallery-59925e317ca052de-r193"
    },
    {
      "recipeId": "gallery-74cfb6f634d00040",
      "variantId": "gallery-74cfb6f634d00040-r164"
    },
    {
      "recipeId": "gallery-75f3f3b97736c4af",
      "variantId": "gallery-75f3f3b97736c4af-r146"
    },
    {
      "recipeId": "gallery-8175c3f8232925c7",
      "variantId": "gallery-8175c3f8232925c7-r028"
    },
    {
      "recipeId": "gallery-92c6e9ce6eb11d6c",
      "variantId": "gallery-92c6e9ce6eb11d6c-r136"
    },
    {
      "recipeId": "gallery-9710fdd58d16a0a8",
      "variantId": "gallery-9710fdd58d16a0a8-r016"
    },
    {
      "recipeId": "gallery-b7faa43f6a1cdf48",
      "variantId": "gallery-b7faa43f6a1cdf48-r300"
    },
    {
      "recipeId": "gallery-cad3b9bd9c2b4acd",
      "variantId": "gallery-cad3b9bd9c2b4acd-r169"
    },
    {
      "recipeId": "gallery-e5c0fc95d63477e7",
      "variantId": "gallery-e5c0fc95d63477e7-r377"
    },
    {
      "recipeId": "gallery-e5fa34b9ae91b2f5",
      "variantId": "gallery-e5fa34b9ae91b2f5-r213"
    },
    {
      "recipeId": "gallery-f6a434fafd7fda90",
      "variantId": "gallery-f6a434fafd7fda90-r211"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-003

簇：`allergy:broccoli`；划分：`development`。

输入候选：
```json
{
  "foodName": "西兰花",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "broccoli",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-05b44f730c2d3918",
      "variantId": "gallery-05b44f730c2d3918-r158"
    },
    {
      "recipeId": "gallery-3cdd52d3168962d6",
      "variantId": "gallery-3cdd52d3168962d6-r340"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-004

簇：`allergy:broccoli`；划分：`development`。

输入候选：
```json
{
  "foodName": "西兰花",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "broccoli",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-05b44f730c2d3918",
      "variantId": "gallery-05b44f730c2d3918-r158"
    },
    {
      "recipeId": "gallery-3cdd52d3168962d6",
      "variantId": "gallery-3cdd52d3168962d6-r340"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-005

簇：`allergy:cabbage`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "白菜",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "cabbage",
  "forbiddenVariants": [
    {
      "recipeId": "community-qianlong-cabbage",
      "variantId": "community-qianlong-cabbage-original"
    },
    {
      "recipeId": "gallery-0c34456cf3a7eac4",
      "variantId": "gallery-0c34456cf3a7eac4-r043"
    },
    {
      "recipeId": "gallery-12986c9aee735c80",
      "variantId": "gallery-12986c9aee735c80-r204"
    },
    {
      "recipeId": "gallery-705165fc7bf1770d",
      "variantId": "gallery-705165fc7bf1770d-r081"
    },
    {
      "recipeId": "gallery-b4a9a18484e8cfcd",
      "variantId": "gallery-b4a9a18484e8cfcd-r027"
    },
    {
      "recipeId": "gallery-c818c20bb971ee81",
      "variantId": "gallery-c818c20bb971ee81-r292"
    },
    {
      "recipeId": "gallery-e6d35bb5c1e60103",
      "variantId": "gallery-e6d35bb5c1e60103-r221"
    },
    {
      "recipeId": "gallery-f3dc92744e6a6c37",
      "variantId": "gallery-f3dc92744e6a6c37-r039"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-006

簇：`allergy:cabbage`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "白菜",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "cabbage",
  "forbiddenVariants": [
    {
      "recipeId": "community-qianlong-cabbage",
      "variantId": "community-qianlong-cabbage-original"
    },
    {
      "recipeId": "gallery-0c34456cf3a7eac4",
      "variantId": "gallery-0c34456cf3a7eac4-r043"
    },
    {
      "recipeId": "gallery-12986c9aee735c80",
      "variantId": "gallery-12986c9aee735c80-r204"
    },
    {
      "recipeId": "gallery-705165fc7bf1770d",
      "variantId": "gallery-705165fc7bf1770d-r081"
    },
    {
      "recipeId": "gallery-b4a9a18484e8cfcd",
      "variantId": "gallery-b4a9a18484e8cfcd-r027"
    },
    {
      "recipeId": "gallery-c818c20bb971ee81",
      "variantId": "gallery-c818c20bb971ee81-r292"
    },
    {
      "recipeId": "gallery-e6d35bb5c1e60103",
      "variantId": "gallery-e6d35bb5c1e60103-r221"
    },
    {
      "recipeId": "gallery-f3dc92744e6a6c37",
      "variantId": "gallery-f3dc92744e6a6c37-r039"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-007

簇：`allergy:carrot`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "胡萝卜",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "carrot",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-06776f0f4433d822",
      "variantId": "gallery-06776f0f4433d822-r257"
    },
    {
      "recipeId": "gallery-0dbf1a1ae620d1c5",
      "variantId": "gallery-0dbf1a1ae620d1c5-r191"
    },
    {
      "recipeId": "gallery-0fb6c8b0242e69f0",
      "variantId": "gallery-0fb6c8b0242e69f0-r290"
    },
    {
      "recipeId": "gallery-26c37f2eac44564d",
      "variantId": "gallery-26c37f2eac44564d-r024"
    },
    {
      "recipeId": "gallery-2d500d3badb2cca5",
      "variantId": "gallery-2d500d3badb2cca5-r233"
    },
    {
      "recipeId": "gallery-371ac91452476ebb",
      "variantId": "gallery-371ac91452476ebb-r130"
    },
    {
      "recipeId": "gallery-42c954f71900836c",
      "variantId": "gallery-42c954f71900836c-r009"
    },
    {
      "recipeId": "gallery-75f3f3b97736c4af",
      "variantId": "gallery-75f3f3b97736c4af-r146"
    },
    {
      "recipeId": "gallery-7b38b489a1b09b42",
      "variantId": "gallery-7b38b489a1b09b42-r264"
    },
    {
      "recipeId": "gallery-7ce5ca6695dab129",
      "variantId": "gallery-7ce5ca6695dab129-r093"
    },
    {
      "recipeId": "gallery-8175c3f8232925c7",
      "variantId": "gallery-8175c3f8232925c7-r028"
    },
    {
      "recipeId": "gallery-88feb147de3fdb95",
      "variantId": "gallery-88feb147de3fdb95-r266"
    },
    {
      "recipeId": "gallery-8b7e31fa59467692",
      "variantId": "gallery-8b7e31fa59467692-r094"
    },
    {
      "recipeId": "gallery-9852b57c36750989",
      "variantId": "gallery-9852b57c36750989-r042"
    },
    {
      "recipeId": "gallery-aee383a78c3a682d",
      "variantId": "gallery-aee383a78c3a682d-r235"
    },
    {
      "recipeId": "gallery-b7faa43f6a1cdf48",
      "variantId": "gallery-b7faa43f6a1cdf48-r300"
    },
    {
      "recipeId": "gallery-c9b12210b44d1aab",
      "variantId": "gallery-c9b12210b44d1aab-r313"
    },
    {
      "recipeId": "gallery-d249e125538fbc8a",
      "variantId": "gallery-d249e125538fbc8a-r254"
    },
    {
      "recipeId": "gallery-edbb21768f83d813",
      "variantId": "gallery-edbb21768f83d813-r388"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-008

簇：`allergy:carrot`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "胡萝卜",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "carrot",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-06776f0f4433d822",
      "variantId": "gallery-06776f0f4433d822-r257"
    },
    {
      "recipeId": "gallery-0dbf1a1ae620d1c5",
      "variantId": "gallery-0dbf1a1ae620d1c5-r191"
    },
    {
      "recipeId": "gallery-0fb6c8b0242e69f0",
      "variantId": "gallery-0fb6c8b0242e69f0-r290"
    },
    {
      "recipeId": "gallery-26c37f2eac44564d",
      "variantId": "gallery-26c37f2eac44564d-r024"
    },
    {
      "recipeId": "gallery-2d500d3badb2cca5",
      "variantId": "gallery-2d500d3badb2cca5-r233"
    },
    {
      "recipeId": "gallery-371ac91452476ebb",
      "variantId": "gallery-371ac91452476ebb-r130"
    },
    {
      "recipeId": "gallery-42c954f71900836c",
      "variantId": "gallery-42c954f71900836c-r009"
    },
    {
      "recipeId": "gallery-75f3f3b97736c4af",
      "variantId": "gallery-75f3f3b97736c4af-r146"
    },
    {
      "recipeId": "gallery-7b38b489a1b09b42",
      "variantId": "gallery-7b38b489a1b09b42-r264"
    },
    {
      "recipeId": "gallery-7ce5ca6695dab129",
      "variantId": "gallery-7ce5ca6695dab129-r093"
    },
    {
      "recipeId": "gallery-8175c3f8232925c7",
      "variantId": "gallery-8175c3f8232925c7-r028"
    },
    {
      "recipeId": "gallery-88feb147de3fdb95",
      "variantId": "gallery-88feb147de3fdb95-r266"
    },
    {
      "recipeId": "gallery-8b7e31fa59467692",
      "variantId": "gallery-8b7e31fa59467692-r094"
    },
    {
      "recipeId": "gallery-9852b57c36750989",
      "variantId": "gallery-9852b57c36750989-r042"
    },
    {
      "recipeId": "gallery-aee383a78c3a682d",
      "variantId": "gallery-aee383a78c3a682d-r235"
    },
    {
      "recipeId": "gallery-b7faa43f6a1cdf48",
      "variantId": "gallery-b7faa43f6a1cdf48-r300"
    },
    {
      "recipeId": "gallery-c9b12210b44d1aab",
      "variantId": "gallery-c9b12210b44d1aab-r313"
    },
    {
      "recipeId": "gallery-d249e125538fbc8a",
      "variantId": "gallery-d249e125538fbc8a-r254"
    },
    {
      "recipeId": "gallery-edbb21768f83d813",
      "variantId": "gallery-edbb21768f83d813-r388"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-009

簇：`allergy:chicken`；划分：`development`。

输入候选：
```json
{
  "foodName": "鸡肉",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "chicken",
  "forbiddenVariants": [
    {
      "recipeId": "community-winter-melon-chicken",
      "variantId": "community-winter-melon-chicken-original"
    },
    {
      "recipeId": "gallery-043f751f2d1d2e84",
      "variantId": "gallery-043f751f2d1d2e84-r068"
    },
    {
      "recipeId": "gallery-2230dd694800796b",
      "variantId": "gallery-2230dd694800796b-r265"
    },
    {
      "recipeId": "gallery-351f19e0a555126c",
      "variantId": "gallery-351f19e0a555126c-r225"
    },
    {
      "recipeId": "gallery-3cd10d8298914211",
      "variantId": "gallery-3cd10d8298914211-r172"
    },
    {
      "recipeId": "gallery-5ba82d7fefc61d9d",
      "variantId": "gallery-5ba82d7fefc61d9d-r386"
    },
    {
      "recipeId": "gallery-6170511e658d2a47",
      "variantId": "gallery-6170511e658d2a47-r011"
    },
    {
      "recipeId": "gallery-6b5ce8920efd7e3f",
      "variantId": "gallery-6b5ce8920efd7e3f-r037"
    },
    {
      "recipeId": "gallery-6bd991acb0a299d5",
      "variantId": "gallery-6bd991acb0a299d5-r148"
    },
    {
      "recipeId": "gallery-6c7c55a05a6d010e",
      "variantId": "gallery-6c7c55a05a6d010e-r156"
    },
    {
      "recipeId": "gallery-8123cf9a4a9f3af1",
      "variantId": "gallery-8123cf9a4a9f3af1-r163"
    },
    {
      "recipeId": "gallery-8b1dc16997617b7f",
      "variantId": "gallery-8b1dc16997617b7f-r135"
    },
    {
      "recipeId": "gallery-b434eb54f909fd32",
      "variantId": "gallery-b434eb54f909fd32-r411"
    },
    {
      "recipeId": "gallery-eb949323d770da7b",
      "variantId": "gallery-eb949323d770da7b-r307"
    },
    {
      "recipeId": "gallery-f09ead55a692109c",
      "variantId": "gallery-f09ead55a692109c-r348"
    },
    {
      "recipeId": "gallery-f21e2361a832ac8c",
      "variantId": "gallery-f21e2361a832ac8c-r065"
    },
    {
      "recipeId": "gallery-f7937a72a47ff9a2",
      "variantId": "gallery-f7937a72a47ff9a2-r030"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-010

簇：`allergy:chicken`；划分：`development`。

输入候选：
```json
{
  "foodName": "鸡肉",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "chicken",
  "forbiddenVariants": [
    {
      "recipeId": "community-winter-melon-chicken",
      "variantId": "community-winter-melon-chicken-original"
    },
    {
      "recipeId": "gallery-043f751f2d1d2e84",
      "variantId": "gallery-043f751f2d1d2e84-r068"
    },
    {
      "recipeId": "gallery-2230dd694800796b",
      "variantId": "gallery-2230dd694800796b-r265"
    },
    {
      "recipeId": "gallery-351f19e0a555126c",
      "variantId": "gallery-351f19e0a555126c-r225"
    },
    {
      "recipeId": "gallery-3cd10d8298914211",
      "variantId": "gallery-3cd10d8298914211-r172"
    },
    {
      "recipeId": "gallery-5ba82d7fefc61d9d",
      "variantId": "gallery-5ba82d7fefc61d9d-r386"
    },
    {
      "recipeId": "gallery-6170511e658d2a47",
      "variantId": "gallery-6170511e658d2a47-r011"
    },
    {
      "recipeId": "gallery-6b5ce8920efd7e3f",
      "variantId": "gallery-6b5ce8920efd7e3f-r037"
    },
    {
      "recipeId": "gallery-6bd991acb0a299d5",
      "variantId": "gallery-6bd991acb0a299d5-r148"
    },
    {
      "recipeId": "gallery-6c7c55a05a6d010e",
      "variantId": "gallery-6c7c55a05a6d010e-r156"
    },
    {
      "recipeId": "gallery-8123cf9a4a9f3af1",
      "variantId": "gallery-8123cf9a4a9f3af1-r163"
    },
    {
      "recipeId": "gallery-8b1dc16997617b7f",
      "variantId": "gallery-8b1dc16997617b7f-r135"
    },
    {
      "recipeId": "gallery-b434eb54f909fd32",
      "variantId": "gallery-b434eb54f909fd32-r411"
    },
    {
      "recipeId": "gallery-eb949323d770da7b",
      "variantId": "gallery-eb949323d770da7b-r307"
    },
    {
      "recipeId": "gallery-f09ead55a692109c",
      "variantId": "gallery-f09ead55a692109c-r348"
    },
    {
      "recipeId": "gallery-f21e2361a832ac8c",
      "variantId": "gallery-f21e2361a832ac8c-r065"
    },
    {
      "recipeId": "gallery-f7937a72a47ff9a2",
      "variantId": "gallery-f7937a72a47ff9a2-r030"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-011

簇：`allergy:cordyceps-flower`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "虫草花",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "cordyceps-flower",
  "forbiddenVariants": [
    {
      "recipeId": "community-winter-melon-chicken",
      "variantId": "community-winter-melon-chicken-original"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-012

簇：`allergy:cordyceps-flower`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "虫草花",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "cordyceps-flower",
  "forbiddenVariants": [
    {
      "recipeId": "community-winter-melon-chicken",
      "variantId": "community-winter-melon-chicken-original"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-013

簇：`allergy:cucumber`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "黄瓜",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "cucumber",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-23a827ca43e6b877",
      "variantId": "gallery-23a827ca43e6b877-r256"
    },
    {
      "recipeId": "gallery-4e274303b433ee2b",
      "variantId": "gallery-4e274303b433ee2b-r311"
    },
    {
      "recipeId": "gallery-5d6f331d61bdd749",
      "variantId": "gallery-5d6f331d61bdd749-r246"
    },
    {
      "recipeId": "gallery-67c1ade1aabade18",
      "variantId": "gallery-67c1ade1aabade18-r063"
    },
    {
      "recipeId": "gallery-6e4d5739667470f9",
      "variantId": "gallery-6e4d5739667470f9-r417"
    },
    {
      "recipeId": "gallery-8b1dc16997617b7f",
      "variantId": "gallery-8b1dc16997617b7f-r135"
    },
    {
      "recipeId": "gallery-967249f023ee262f",
      "variantId": "gallery-967249f023ee262f-r133"
    },
    {
      "recipeId": "gallery-a49d863acdfe973e",
      "variantId": "gallery-a49d863acdfe973e-r198"
    },
    {
      "recipeId": "gallery-c10a62b79900dfdc",
      "variantId": "gallery-c10a62b79900dfdc-r330"
    },
    {
      "recipeId": "gallery-e5fa34b9ae91b2f5",
      "variantId": "gallery-e5fa34b9ae91b2f5-r213"
    },
    {
      "recipeId": "gallery-f1b23ae5b6b4836b",
      "variantId": "gallery-f1b23ae5b6b4836b-r277"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-014

簇：`allergy:cucumber`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "黄瓜",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "cucumber",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-23a827ca43e6b877",
      "variantId": "gallery-23a827ca43e6b877-r256"
    },
    {
      "recipeId": "gallery-4e274303b433ee2b",
      "variantId": "gallery-4e274303b433ee2b-r311"
    },
    {
      "recipeId": "gallery-5d6f331d61bdd749",
      "variantId": "gallery-5d6f331d61bdd749-r246"
    },
    {
      "recipeId": "gallery-67c1ade1aabade18",
      "variantId": "gallery-67c1ade1aabade18-r063"
    },
    {
      "recipeId": "gallery-6e4d5739667470f9",
      "variantId": "gallery-6e4d5739667470f9-r417"
    },
    {
      "recipeId": "gallery-8b1dc16997617b7f",
      "variantId": "gallery-8b1dc16997617b7f-r135"
    },
    {
      "recipeId": "gallery-967249f023ee262f",
      "variantId": "gallery-967249f023ee262f-r133"
    },
    {
      "recipeId": "gallery-a49d863acdfe973e",
      "variantId": "gallery-a49d863acdfe973e-r198"
    },
    {
      "recipeId": "gallery-c10a62b79900dfdc",
      "variantId": "gallery-c10a62b79900dfdc-r330"
    },
    {
      "recipeId": "gallery-e5fa34b9ae91b2f5",
      "variantId": "gallery-e5fa34b9ae91b2f5-r213"
    },
    {
      "recipeId": "gallery-f1b23ae5b6b4836b",
      "variantId": "gallery-f1b23ae5b6b4836b-r277"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-015

簇：`allergy:egg`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "鸡蛋",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "egg",
  "forbiddenVariants": [
    {
      "recipeId": "community-spinach-eggs",
      "variantId": "community-spinach-eggs-original"
    },
    {
      "recipeId": "gallery-16f96bf406ac8eb7",
      "variantId": "gallery-16f96bf406ac8eb7-r197"
    },
    {
      "recipeId": "gallery-19171711133d8067",
      "variantId": "gallery-19171711133d8067-r187"
    },
    {
      "recipeId": "gallery-243f1ece3078a09c",
      "variantId": "gallery-243f1ece3078a09c-r268"
    },
    {
      "recipeId": "gallery-33ed251c9be8eb31",
      "variantId": "gallery-33ed251c9be8eb31-r238"
    },
    {
      "recipeId": "gallery-41744c72e4d48003",
      "variantId": "gallery-41744c72e4d48003-r372"
    },
    {
      "recipeId": "gallery-4992d3405148ca4f",
      "variantId": "gallery-4992d3405148ca4f-r260"
    },
    {
      "recipeId": "gallery-50cdf7b050bc1794",
      "variantId": "gallery-50cdf7b050bc1794-r153"
    },
    {
      "recipeId": "gallery-592ab61e73a81951",
      "variantId": "gallery-592ab61e73a81951-r004"
    },
    {
      "recipeId": "gallery-5f5395367336d1ec",
      "variantId": "gallery-5f5395367336d1ec-r384"
    },
    {
      "recipeId": "gallery-64a7eb12cfd57ca3",
      "variantId": "gallery-64a7eb12cfd57ca3-r183"
    },
    {
      "recipeId": "gallery-656ebbd6cc412ec0",
      "variantId": "gallery-656ebbd6cc412ec0-r278"
    },
    {
      "recipeId": "gallery-705165fc7bf1770d",
      "variantId": "gallery-705165fc7bf1770d-r081"
    },
    {
      "recipeId": "gallery-73382d8ab5f3df84",
      "variantId": "gallery-73382d8ab5f3df84-r034"
    },
    {
      "recipeId": "gallery-792e3eb4b73947d0",
      "variantId": "gallery-792e3eb4b73947d0-r056"
    },
    {
      "recipeId": "gallery-792e3eb4b73947d0",
      "variantId": "gallery-792e3eb4b73947d0-r055"
    },
    {
      "recipeId": "gallery-7b38b489a1b09b42",
      "variantId": "gallery-7b38b489a1b09b42-r264"
    },
    {
      "recipeId": "gallery-82c89a5d4112a9c1",
      "variantId": "gallery-82c89a5d4112a9c1-r088"
    },
    {
      "recipeId": "gallery-83abea194af36759",
      "variantId": "gallery-83abea194af36759-r351"
    },
    {
      "recipeId": "gallery-864a4ab520484c3a",
      "variantId": "gallery-864a4ab520484c3a-r299"
    },
    {
      "recipeId": "gallery-8a63f4a675c253b3",
      "variantId": "gallery-8a63f4a675c253b3-r415"
    },
    {
      "recipeId": "gallery-8b7e31fa59467692",
      "variantId": "gallery-8b7e31fa59467692-r094"
    },
    {
      "recipeId": "gallery-8d3817ce625d058b",
      "variantId": "gallery-8d3817ce625d058b-r310"
    },
    {
      "recipeId": "gallery-8dd5d3e8aa28bf8d",
      "variantId": "gallery-8dd5d3e8aa28bf8d-r344"
    },
    {
      "recipeId": "gallery-8f2b487749986928",
      "variantId": "gallery-8f2b487749986928-r308"
    },
    {
      "recipeId": "gallery-933f0846700b33a5",
      "variantId": "gallery-933f0846700b33a5-r237"
    },
    {
      "recipeId": "gallery-9465938ff4b4edb8",
      "variantId": "gallery-9465938ff4b4edb8-r279"
    },
    {
      "recipeId": "gallery-964e27e963df59e3",
      "variantId": "gallery-964e27e963df59e3-r418"
    },
    {
      "recipeId": "gallery-9b9d9fc5663f4f96",
      "variantId": "gallery-9b9d9fc5663f4f96-r007"
    },
    {
      "recipeId": "gallery-aa92bfd734ee175c",
      "variantId": "gallery-aa92bfd734ee175c-r087"
    },
    {
      "recipeId": "gallery-af7b0723bb079108",
      "variantId": "gallery-af7b0723bb079108-r180"
    },
    {
      "recipeId": "gallery-bbe0781e4404d78f",
      "variantId": "gallery-bbe0781e4404d78f-r188"
    },
    {
      "recipeId": "gallery-c10a62b79900dfdc",
      "variantId": "gallery-c10a62b79900dfdc-r330"
    },
    {
      "recipeId": "gallery-c16913d5f3ff568b",
      "variantId": "gallery-c16913d5f3ff568b-r361"
    },
    {
      "recipeId": "gallery-c369195e4e7472de",
      "variantId": "gallery-c369195e4e7472de-r097"
    },
    {
      "recipeId": "gallery-c4720120e7fa14c9",
      "variantId": "gallery-c4720120e7fa14c9-r353"
    },
    {
      "recipeId": "gallery-cad3b9bd9c2b4acd",
      "variantId": "gallery-cad3b9bd9c2b4acd-r169"
    },
    {
      "recipeId": "gallery-d6f461ea41cdffe6",
      "variantId": "gallery-d6f461ea41cdffe6-r262"
    },
    {
      "recipeId": "gallery-dbe61b0b9e5b4dea",
      "variantId": "gallery-dbe61b0b9e5b4dea-r217"
    },
    {
      "recipeId": "gallery-e6d35bb5c1e60103",
      "variantId": "gallery-e6d35bb5c1e60103-r221"
    },
    {
      "recipeId": "gallery-e82f11e4d8e3e45a",
      "variantId": "gallery-e82f11e4d8e3e45a-r103"
    },
    {
      "recipeId": "gallery-e9cfd02bb3d7e457",
      "variantId": "gallery-e9cfd02bb3d7e457-r285"
    },
    {
      "recipeId": "gallery-ec46e4dad748c80a",
      "variantId": "gallery-ec46e4dad748c80a-r111"
    },
    {
      "recipeId": "gallery-f3d1d10011b24172",
      "variantId": "gallery-f3d1d10011b24172-r365"
    },
    {
      "recipeId": "gallery-f3fff1f7454b914e",
      "variantId": "gallery-f3fff1f7454b914e-r335"
    },
    {
      "recipeId": "gallery-fbaf258f883e18a2",
      "variantId": "gallery-fbaf258f883e18a2-r089"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-016

簇：`allergy:egg`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "鸡蛋",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "egg",
  "forbiddenVariants": [
    {
      "recipeId": "community-spinach-eggs",
      "variantId": "community-spinach-eggs-original"
    },
    {
      "recipeId": "gallery-16f96bf406ac8eb7",
      "variantId": "gallery-16f96bf406ac8eb7-r197"
    },
    {
      "recipeId": "gallery-19171711133d8067",
      "variantId": "gallery-19171711133d8067-r187"
    },
    {
      "recipeId": "gallery-243f1ece3078a09c",
      "variantId": "gallery-243f1ece3078a09c-r268"
    },
    {
      "recipeId": "gallery-33ed251c9be8eb31",
      "variantId": "gallery-33ed251c9be8eb31-r238"
    },
    {
      "recipeId": "gallery-41744c72e4d48003",
      "variantId": "gallery-41744c72e4d48003-r372"
    },
    {
      "recipeId": "gallery-4992d3405148ca4f",
      "variantId": "gallery-4992d3405148ca4f-r260"
    },
    {
      "recipeId": "gallery-50cdf7b050bc1794",
      "variantId": "gallery-50cdf7b050bc1794-r153"
    },
    {
      "recipeId": "gallery-592ab61e73a81951",
      "variantId": "gallery-592ab61e73a81951-r004"
    },
    {
      "recipeId": "gallery-5f5395367336d1ec",
      "variantId": "gallery-5f5395367336d1ec-r384"
    },
    {
      "recipeId": "gallery-64a7eb12cfd57ca3",
      "variantId": "gallery-64a7eb12cfd57ca3-r183"
    },
    {
      "recipeId": "gallery-656ebbd6cc412ec0",
      "variantId": "gallery-656ebbd6cc412ec0-r278"
    },
    {
      "recipeId": "gallery-705165fc7bf1770d",
      "variantId": "gallery-705165fc7bf1770d-r081"
    },
    {
      "recipeId": "gallery-73382d8ab5f3df84",
      "variantId": "gallery-73382d8ab5f3df84-r034"
    },
    {
      "recipeId": "gallery-792e3eb4b73947d0",
      "variantId": "gallery-792e3eb4b73947d0-r056"
    },
    {
      "recipeId": "gallery-792e3eb4b73947d0",
      "variantId": "gallery-792e3eb4b73947d0-r055"
    },
    {
      "recipeId": "gallery-7b38b489a1b09b42",
      "variantId": "gallery-7b38b489a1b09b42-r264"
    },
    {
      "recipeId": "gallery-82c89a5d4112a9c1",
      "variantId": "gallery-82c89a5d4112a9c1-r088"
    },
    {
      "recipeId": "gallery-83abea194af36759",
      "variantId": "gallery-83abea194af36759-r351"
    },
    {
      "recipeId": "gallery-864a4ab520484c3a",
      "variantId": "gallery-864a4ab520484c3a-r299"
    },
    {
      "recipeId": "gallery-8a63f4a675c253b3",
      "variantId": "gallery-8a63f4a675c253b3-r415"
    },
    {
      "recipeId": "gallery-8b7e31fa59467692",
      "variantId": "gallery-8b7e31fa59467692-r094"
    },
    {
      "recipeId": "gallery-8d3817ce625d058b",
      "variantId": "gallery-8d3817ce625d058b-r310"
    },
    {
      "recipeId": "gallery-8dd5d3e8aa28bf8d",
      "variantId": "gallery-8dd5d3e8aa28bf8d-r344"
    },
    {
      "recipeId": "gallery-8f2b487749986928",
      "variantId": "gallery-8f2b487749986928-r308"
    },
    {
      "recipeId": "gallery-933f0846700b33a5",
      "variantId": "gallery-933f0846700b33a5-r237"
    },
    {
      "recipeId": "gallery-9465938ff4b4edb8",
      "variantId": "gallery-9465938ff4b4edb8-r279"
    },
    {
      "recipeId": "gallery-964e27e963df59e3",
      "variantId": "gallery-964e27e963df59e3-r418"
    },
    {
      "recipeId": "gallery-9b9d9fc5663f4f96",
      "variantId": "gallery-9b9d9fc5663f4f96-r007"
    },
    {
      "recipeId": "gallery-aa92bfd734ee175c",
      "variantId": "gallery-aa92bfd734ee175c-r087"
    },
    {
      "recipeId": "gallery-af7b0723bb079108",
      "variantId": "gallery-af7b0723bb079108-r180"
    },
    {
      "recipeId": "gallery-bbe0781e4404d78f",
      "variantId": "gallery-bbe0781e4404d78f-r188"
    },
    {
      "recipeId": "gallery-c10a62b79900dfdc",
      "variantId": "gallery-c10a62b79900dfdc-r330"
    },
    {
      "recipeId": "gallery-c16913d5f3ff568b",
      "variantId": "gallery-c16913d5f3ff568b-r361"
    },
    {
      "recipeId": "gallery-c369195e4e7472de",
      "variantId": "gallery-c369195e4e7472de-r097"
    },
    {
      "recipeId": "gallery-c4720120e7fa14c9",
      "variantId": "gallery-c4720120e7fa14c9-r353"
    },
    {
      "recipeId": "gallery-cad3b9bd9c2b4acd",
      "variantId": "gallery-cad3b9bd9c2b4acd-r169"
    },
    {
      "recipeId": "gallery-d6f461ea41cdffe6",
      "variantId": "gallery-d6f461ea41cdffe6-r262"
    },
    {
      "recipeId": "gallery-dbe61b0b9e5b4dea",
      "variantId": "gallery-dbe61b0b9e5b4dea-r217"
    },
    {
      "recipeId": "gallery-e6d35bb5c1e60103",
      "variantId": "gallery-e6d35bb5c1e60103-r221"
    },
    {
      "recipeId": "gallery-e82f11e4d8e3e45a",
      "variantId": "gallery-e82f11e4d8e3e45a-r103"
    },
    {
      "recipeId": "gallery-e9cfd02bb3d7e457",
      "variantId": "gallery-e9cfd02bb3d7e457-r285"
    },
    {
      "recipeId": "gallery-ec46e4dad748c80a",
      "variantId": "gallery-ec46e4dad748c80a-r111"
    },
    {
      "recipeId": "gallery-f3d1d10011b24172",
      "variantId": "gallery-f3d1d10011b24172-r365"
    },
    {
      "recipeId": "gallery-f3fff1f7454b914e",
      "variantId": "gallery-f3fff1f7454b914e-r335"
    },
    {
      "recipeId": "gallery-fbaf258f883e18a2",
      "variantId": "gallery-fbaf258f883e18a2-r089"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-017

簇：`allergy:fish`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "鱼",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "fish",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-5d6f331d61bdd749",
      "variantId": "gallery-5d6f331d61bdd749-r246"
    },
    {
      "recipeId": "gallery-933f0846700b33a5",
      "variantId": "gallery-933f0846700b33a5-r237"
    },
    {
      "recipeId": "gallery-9fd1d507b358520d",
      "variantId": "gallery-9fd1d507b358520d-r314"
    },
    {
      "recipeId": "gallery-ff98cd823bc9c3e1",
      "variantId": "gallery-ff98cd823bc9c3e1-r195"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-018

簇：`allergy:fish`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "鱼",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "fish",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-5d6f331d61bdd749",
      "variantId": "gallery-5d6f331d61bdd749-r246"
    },
    {
      "recipeId": "gallery-933f0846700b33a5",
      "variantId": "gallery-933f0846700b33a5-r237"
    },
    {
      "recipeId": "gallery-9fd1d507b358520d",
      "variantId": "gallery-9fd1d507b358520d-r314"
    },
    {
      "recipeId": "gallery-ff98cd823bc9c3e1",
      "variantId": "gallery-ff98cd823bc9c3e1-r195"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-019

簇：`allergy:gallery-food-009c2d87c53a19fc`；划分：`development`。

输入候选：
```json
{
  "foodName": "榨菜",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-009c2d87c53a19fc",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-9710fdd58d16a0a8",
      "variantId": "gallery-9710fdd58d16a0a8-r016"
    },
    {
      "recipeId": "gallery-dbe61b0b9e5b4dea",
      "variantId": "gallery-dbe61b0b9e5b4dea-r217"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-020

簇：`allergy:gallery-food-009c2d87c53a19fc`；划分：`development`。

输入候选：
```json
{
  "foodName": "榨菜",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-009c2d87c53a19fc",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-9710fdd58d16a0a8",
      "variantId": "gallery-9710fdd58d16a0a8-r016"
    },
    {
      "recipeId": "gallery-dbe61b0b9e5b4dea",
      "variantId": "gallery-dbe61b0b9e5b4dea-r217"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-021

簇：`allergy:gallery-food-00b3aecbb19f4724`；划分：`development`。

输入候选：
```json
{
  "foodName": "培根",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-00b3aecbb19f4724",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-74dfa4b3b77e27ad",
      "variantId": "gallery-74dfa4b3b77e27ad-r223"
    },
    {
      "recipeId": "gallery-ebc9038d53f710cc",
      "variantId": "gallery-ebc9038d53f710cc-r105"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-022

簇：`allergy:gallery-food-00b3aecbb19f4724`；划分：`development`。

输入候选：
```json
{
  "foodName": "培根",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-00b3aecbb19f4724",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-74dfa4b3b77e27ad",
      "variantId": "gallery-74dfa4b3b77e27ad-r223"
    },
    {
      "recipeId": "gallery-ebc9038d53f710cc",
      "variantId": "gallery-ebc9038d53f710cc-r105"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-023

簇：`allergy:gallery-food-0320138e3031a79c`；划分：`development`。

输入候选：
```json
{
  "foodName": "猪蹄",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-0320138e3031a79c",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-33e3198e19f1355e",
      "variantId": "gallery-33e3198e19f1355e-r263"
    },
    {
      "recipeId": "gallery-666a105a92975e85",
      "variantId": "gallery-666a105a92975e85-r230"
    },
    {
      "recipeId": "gallery-c5c1c00f90d3bc9f",
      "variantId": "gallery-c5c1c00f90d3bc9f-r205"
    },
    {
      "recipeId": "gallery-d463606ff2cfeb72",
      "variantId": "gallery-d463606ff2cfeb72-r239"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-024

簇：`allergy:gallery-food-0320138e3031a79c`；划分：`development`。

输入候选：
```json
{
  "foodName": "猪蹄",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-0320138e3031a79c",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-33e3198e19f1355e",
      "variantId": "gallery-33e3198e19f1355e-r263"
    },
    {
      "recipeId": "gallery-666a105a92975e85",
      "variantId": "gallery-666a105a92975e85-r230"
    },
    {
      "recipeId": "gallery-c5c1c00f90d3bc9f",
      "variantId": "gallery-c5c1c00f90d3bc9f-r205"
    },
    {
      "recipeId": "gallery-d463606ff2cfeb72",
      "variantId": "gallery-d463606ff2cfeb72-r239"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-025

簇：`allergy:gallery-food-0384636e421ad642`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "玉米",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-0384636e421ad642",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-0fb6c8b0242e69f0",
      "variantId": "gallery-0fb6c8b0242e69f0-r290"
    },
    {
      "recipeId": "gallery-42c954f71900836c",
      "variantId": "gallery-42c954f71900836c-r009"
    },
    {
      "recipeId": "gallery-88feb147de3fdb95",
      "variantId": "gallery-88feb147de3fdb95-r266"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-026

簇：`allergy:gallery-food-0384636e421ad642`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "玉米",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-0384636e421ad642",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-0fb6c8b0242e69f0",
      "variantId": "gallery-0fb6c8b0242e69f0-r290"
    },
    {
      "recipeId": "gallery-42c954f71900836c",
      "variantId": "gallery-42c954f71900836c-r009"
    },
    {
      "recipeId": "gallery-88feb147de3fdb95",
      "variantId": "gallery-88feb147de3fdb95-r266"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-027

簇：`allergy:gallery-food-03ce4de0ac59ddcf`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "猪里脊肉",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-03ce4de0ac59ddcf",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-75d7d2a21f80ee98",
      "variantId": "gallery-75d7d2a21f80ee98-r124"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-028

簇：`allergy:gallery-food-03ce4de0ac59ddcf`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "猪里脊肉",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-03ce4de0ac59ddcf",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-75d7d2a21f80ee98",
      "variantId": "gallery-75d7d2a21f80ee98-r124"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-029

簇：`allergy:gallery-food-03f3ffefcd80e11e`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "芹菜段",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-03f3ffefcd80e11e",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-60f34f1dc1ae51a2",
      "variantId": "gallery-60f34f1dc1ae51a2-r331"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-030

簇：`allergy:gallery-food-03f3ffefcd80e11e`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "芹菜段",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-03f3ffefcd80e11e",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-60f34f1dc1ae51a2",
      "variantId": "gallery-60f34f1dc1ae51a2-r331"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-031

簇：`allergy:gallery-food-04a2228f5278aa90`；划分：`development`。

输入候选：
```json
{
  "foodName": "蒜苔",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-04a2228f5278aa90",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-d28c602fc4da9ae9",
      "variantId": "gallery-d28c602fc4da9ae9-s002"
    },
    {
      "recipeId": "gallery-d6f461ea41cdffe6",
      "variantId": "gallery-d6f461ea41cdffe6-r262"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-032

簇：`allergy:gallery-food-04a2228f5278aa90`；划分：`development`。

输入候选：
```json
{
  "foodName": "蒜苔",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-04a2228f5278aa90",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-d28c602fc4da9ae9",
      "variantId": "gallery-d28c602fc4da9ae9-s002"
    },
    {
      "recipeId": "gallery-d6f461ea41cdffe6",
      "variantId": "gallery-d6f461ea41cdffe6-r262"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-033

簇：`allergy:gallery-food-04b12dbad56b6c1b`；划分：`development`。

输入候选：
```json
{
  "foodName": "草鱼",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-04b12dbad56b6c1b",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-1b4d4d3a110ac53e",
      "variantId": "gallery-1b4d4d3a110ac53e-r109"
    },
    {
      "recipeId": "gallery-382a54b6c7d1e201",
      "variantId": "gallery-382a54b6c7d1e201-r182"
    },
    {
      "recipeId": "gallery-60f34f1dc1ae51a2",
      "variantId": "gallery-60f34f1dc1ae51a2-r331"
    },
    {
      "recipeId": "gallery-80cab1fec81cbf42",
      "variantId": "gallery-80cab1fec81cbf42-r128"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-034

簇：`allergy:gallery-food-04b12dbad56b6c1b`；划分：`development`。

输入候选：
```json
{
  "foodName": "草鱼",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-04b12dbad56b6c1b",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-1b4d4d3a110ac53e",
      "variantId": "gallery-1b4d4d3a110ac53e-r109"
    },
    {
      "recipeId": "gallery-382a54b6c7d1e201",
      "variantId": "gallery-382a54b6c7d1e201-r182"
    },
    {
      "recipeId": "gallery-60f34f1dc1ae51a2",
      "variantId": "gallery-60f34f1dc1ae51a2-r331"
    },
    {
      "recipeId": "gallery-80cab1fec81cbf42",
      "variantId": "gallery-80cab1fec81cbf42-r128"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-035

簇：`allergy:gallery-food-04b3cdae9e680521`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "芸豆",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-04b3cdae9e680521",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-0d82254093b08e71",
      "variantId": "gallery-0d82254093b08e71-r029"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-036

簇：`allergy:gallery-food-04b3cdae9e680521`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "芸豆",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-04b3cdae9e680521",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-0d82254093b08e71",
      "variantId": "gallery-0d82254093b08e71-r029"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-037

簇：`allergy:gallery-food-04bf1bcc3fe14f82`；划分：`development`。

输入候选：
```json
{
  "foodName": "味素",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-04bf1bcc3fe14f82",
  "forbiddenVariants": [],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-038

簇：`allergy:gallery-food-04bf1bcc3fe14f82`；划分：`development`。

输入候选：
```json
{
  "foodName": "味素",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-04bf1bcc3fe14f82",
  "forbiddenVariants": [],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-039

簇：`allergy:gallery-food-04e92b744fadfeae`；划分：`development`。

输入候选：
```json
{
  "foodName": "韭花酱",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-04e92b744fadfeae",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-ecf308190dd7388e",
      "variantId": "gallery-ecf308190dd7388e-r216"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-040

簇：`allergy:gallery-food-04e92b744fadfeae`；划分：`development`。

输入候选：
```json
{
  "foodName": "韭花酱",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-04e92b744fadfeae",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-ecf308190dd7388e",
      "variantId": "gallery-ecf308190dd7388e-r216"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-041

簇：`allergy:gallery-food-05b6bc33a55b9ed4`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "鸡",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-05b6bc33a55b9ed4",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-2834a020554b81f3",
      "variantId": "gallery-2834a020554b81f3-r387"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-042

簇：`allergy:gallery-food-05b6bc33a55b9ed4`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "鸡",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-05b6bc33a55b9ed4",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-2834a020554b81f3",
      "variantId": "gallery-2834a020554b81f3-r387"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-043

簇：`allergy:gallery-food-07eaaf66424db62b`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "猪通脊",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-07eaaf66424db62b",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-873d1a70fe8bda7b",
      "variantId": "gallery-873d1a70fe8bda7b-r079"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-044

簇：`allergy:gallery-food-07eaaf66424db62b`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "猪通脊",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-07eaaf66424db62b",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-873d1a70fe8bda7b",
      "variantId": "gallery-873d1a70fe8bda7b-r079"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-045

簇：`allergy:gallery-food-0c0d12fc4a6e74bb`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "茭白",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-0c0d12fc4a6e74bb",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-ac6bf9a794d64329",
      "variantId": "gallery-ac6bf9a794d64329-r333"
    },
    {
      "recipeId": "gallery-b45f245d1263f86c",
      "variantId": "gallery-b45f245d1263f86c-r179"
    },
    {
      "recipeId": "gallery-f7fbcd273ea88b5b",
      "variantId": "gallery-f7fbcd273ea88b5b-r123"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-046

簇：`allergy:gallery-food-0c0d12fc4a6e74bb`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "茭白",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-0c0d12fc4a6e74bb",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-ac6bf9a794d64329",
      "variantId": "gallery-ac6bf9a794d64329-r333"
    },
    {
      "recipeId": "gallery-b45f245d1263f86c",
      "variantId": "gallery-b45f245d1263f86c-r179"
    },
    {
      "recipeId": "gallery-f7fbcd273ea88b5b",
      "variantId": "gallery-f7fbcd273ea88b5b-r123"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-047

簇：`allergy:gallery-food-0d6f7ccc49ab37b0`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "肥牛卷",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-0d6f7ccc49ab37b0",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-edbb21768f83d813",
      "variantId": "gallery-edbb21768f83d813-r388"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-048

簇：`allergy:gallery-food-0d6f7ccc49ab37b0`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "肥牛卷",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-0d6f7ccc49ab37b0",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-edbb21768f83d813",
      "variantId": "gallery-edbb21768f83d813-r388"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-049

簇：`allergy:gallery-food-0e918b32cebf9606`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "腐竹",
  "kind": "allergy",
  "allowBuy": false
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-0e918b32cebf9606",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-65b162b844c6c216",
      "variantId": "gallery-65b162b844c6c216-r168"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## allergy-050

簇：`allergy:gallery-food-0e918b32cebf9606`；划分：`holdout_candidate`。

输入候选：
```json
{
  "foodName": "腐竹",
  "kind": "avoid",
  "allowBuy": true
}
```

预期候选：
```json
{
  "listedFoodId": "gallery-food-0e918b32cebf9606",
  "forbiddenVariants": [
    {
      "recipeId": "gallery-65b162b844c6c216",
      "variantId": "gallery-65b162b844c6c216-r168"
    }
  ],
  "mustNotLoosenRestriction": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。
