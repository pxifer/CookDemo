# 疾病条件与证据边界：待独立审核

所有标签仍为候选；本材料没有生成审核人名或批准结论。

## disease-001

簇：`disease:d:hypertension`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人高血压",
  "scenario": "conditions_missing"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:ht-sodium",
    "fact:ht-potassium",
    "fact:ht-saturated-fat",
    "fact:ht-alcohol",
    "fact:ht-prefer-fresh-vegetables"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-002

簇：`disease:d:hypertension`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人高血压",
  "scenario": "multiple_concerns"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:ht-sodium",
    "fact:ht-potassium",
    "fact:ht-saturated-fat",
    "fact:ht-alcohol",
    "fact:ht-prefer-fresh-vegetables"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-003

簇：`disease:d:hypertension`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人高血压",
  "scenario": "conflicting_advice"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:ht-sodium",
    "fact:ht-potassium",
    "fact:ht-saturated-fat",
    "fact:ht-alcohol",
    "fact:ht-prefer-fresh-vegetables"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-004

簇：`disease:d:hypertension`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人高血压",
  "scenario": "unknown_food_form"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:ht-sodium",
    "fact:ht-potassium",
    "fact:ht-saturated-fat",
    "fact:ht-alcohol",
    "fact:ht-prefer-fresh-vegetables"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-005

簇：`disease:d:hypertension`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人高血压",
  "scenario": "source_withdrawn"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:ht-sodium",
    "fact:ht-potassium",
    "fact:ht-saturated-fat",
    "fact:ht-alcohol",
    "fact:ht-prefer-fresh-vegetables"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-006

簇：`disease:d:type2-diabetes`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人2型糖尿病",
  "scenario": "conditions_missing"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:dm-carbohydrate",
    "fact:dm-fiber",
    "fact:dm-ethanol-effect",
    "fact:dm-prefer-whole-grains",
    "fact:dm-prefer-pulses"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-007

簇：`disease:d:type2-diabetes`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人2型糖尿病",
  "scenario": "multiple_concerns"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:dm-carbohydrate",
    "fact:dm-fiber",
    "fact:dm-ethanol-effect",
    "fact:dm-prefer-whole-grains",
    "fact:dm-prefer-pulses"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-008

簇：`disease:d:type2-diabetes`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人2型糖尿病",
  "scenario": "conflicting_advice"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:dm-carbohydrate",
    "fact:dm-fiber",
    "fact:dm-ethanol-effect",
    "fact:dm-prefer-whole-grains",
    "fact:dm-prefer-pulses"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-009

簇：`disease:d:type2-diabetes`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人2型糖尿病",
  "scenario": "unknown_food_form"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:dm-carbohydrate",
    "fact:dm-fiber",
    "fact:dm-ethanol-effect",
    "fact:dm-prefer-whole-grains",
    "fact:dm-prefer-pulses"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-010

簇：`disease:d:type2-diabetes`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人2型糖尿病",
  "scenario": "source_withdrawn"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:dm-carbohydrate",
    "fact:dm-fiber",
    "fact:dm-ethanol-effect",
    "fact:dm-prefer-whole-grains",
    "fact:dm-prefer-pulses"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-011

簇：`disease:d:gout`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人痛风",
  "scenario": "conditions_missing"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:gout-purines",
    "fact:gout-fructose",
    "fact:gout-ethanol",
    "fact:gout-milk-protein",
    "fact:gout-prefer-milk"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-012

簇：`disease:d:gout`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人痛风",
  "scenario": "multiple_concerns"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:gout-purines",
    "fact:gout-fructose",
    "fact:gout-ethanol",
    "fact:gout-milk-protein",
    "fact:gout-prefer-milk"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-013

簇：`disease:d:gout`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人痛风",
  "scenario": "conflicting_advice"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:gout-purines",
    "fact:gout-fructose",
    "fact:gout-ethanol",
    "fact:gout-milk-protein",
    "fact:gout-prefer-milk"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-014

簇：`disease:d:gout`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人痛风",
  "scenario": "unknown_food_form"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:gout-purines",
    "fact:gout-fructose",
    "fact:gout-ethanol",
    "fact:gout-milk-protein",
    "fact:gout-prefer-milk"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-015

簇：`disease:d:gout`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人痛风",
  "scenario": "source_withdrawn"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:gout-purines",
    "fact:gout-fructose",
    "fact:gout-ethanol",
    "fact:gout-milk-protein",
    "fact:gout-prefer-milk"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-016

簇：`disease:d:hyperuricemia`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人高尿酸血症",
  "scenario": "conditions_missing"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:hyperuricemia-purines",
    "fact:hyperuricemia-fructose",
    "fact:hyperuricemia-ethanol",
    "fact:hyperuricemia-milk-protein",
    "fact:hyperuricemia-prefer-milk"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-017

簇：`disease:d:hyperuricemia`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人高尿酸血症",
  "scenario": "multiple_concerns"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:hyperuricemia-purines",
    "fact:hyperuricemia-fructose",
    "fact:hyperuricemia-ethanol",
    "fact:hyperuricemia-milk-protein",
    "fact:hyperuricemia-prefer-milk"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-018

簇：`disease:d:hyperuricemia`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人高尿酸血症",
  "scenario": "conflicting_advice"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:hyperuricemia-purines",
    "fact:hyperuricemia-fructose",
    "fact:hyperuricemia-ethanol",
    "fact:hyperuricemia-milk-protein",
    "fact:hyperuricemia-prefer-milk"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-019

簇：`disease:d:hyperuricemia`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人高尿酸血症",
  "scenario": "unknown_food_form"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:hyperuricemia-purines",
    "fact:hyperuricemia-fructose",
    "fact:hyperuricemia-ethanol",
    "fact:hyperuricemia-milk-protein",
    "fact:hyperuricemia-prefer-milk"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-020

簇：`disease:d:hyperuricemia`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人高尿酸血症",
  "scenario": "source_withdrawn"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:hyperuricemia-purines",
    "fact:hyperuricemia-fructose",
    "fact:hyperuricemia-ethanol",
    "fact:hyperuricemia-milk-protein",
    "fact:hyperuricemia-prefer-milk"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-021

簇：`disease:d:dyslipidemia`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人高脂血症",
  "scenario": "conditions_missing"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:lipid-saturated-fat",
    "fact:lipid-trans-fat",
    "fact:lipid-unsaturated",
    "fact:lipid-fiber",
    "fact:lipid-cholesterol"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-022

簇：`disease:d:dyslipidemia`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人高脂血症",
  "scenario": "multiple_concerns"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:lipid-saturated-fat",
    "fact:lipid-trans-fat",
    "fact:lipid-unsaturated",
    "fact:lipid-fiber",
    "fact:lipid-cholesterol"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-023

簇：`disease:d:dyslipidemia`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人高脂血症",
  "scenario": "conflicting_advice"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:lipid-saturated-fat",
    "fact:lipid-trans-fat",
    "fact:lipid-unsaturated",
    "fact:lipid-fiber",
    "fact:lipid-cholesterol"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-024

簇：`disease:d:dyslipidemia`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人高脂血症",
  "scenario": "unknown_food_form"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:lipid-saturated-fat",
    "fact:lipid-trans-fat",
    "fact:lipid-unsaturated",
    "fact:lipid-fiber",
    "fact:lipid-cholesterol"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-025

簇：`disease:d:dyslipidemia`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人高脂血症",
  "scenario": "source_withdrawn"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:lipid-saturated-fat",
    "fact:lipid-trans-fat",
    "fact:lipid-unsaturated",
    "fact:lipid-fiber",
    "fact:lipid-cholesterol"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-026

簇：`disease:d:obesity`；划分：`development`。

输入候选：
```json
{
  "concern": "成人肥胖症",
  "scenario": "conditions_missing"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:ob-fat",
    "fact:ob-fiber",
    "fact:ob-added-sugar",
    "fact:ob-ethanol",
    "fact:ob-prefer-whole-grains"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-027

簇：`disease:d:obesity`；划分：`development`。

输入候选：
```json
{
  "concern": "成人肥胖症",
  "scenario": "multiple_concerns"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:ob-fat",
    "fact:ob-fiber",
    "fact:ob-added-sugar",
    "fact:ob-ethanol",
    "fact:ob-prefer-whole-grains"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-028

簇：`disease:d:obesity`；划分：`development`。

输入候选：
```json
{
  "concern": "成人肥胖症",
  "scenario": "conflicting_advice"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:ob-fat",
    "fact:ob-fiber",
    "fact:ob-added-sugar",
    "fact:ob-ethanol",
    "fact:ob-prefer-whole-grains"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-029

簇：`disease:d:obesity`；划分：`development`。

输入候选：
```json
{
  "concern": "成人肥胖症",
  "scenario": "unknown_food_form"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:ob-fat",
    "fact:ob-fiber",
    "fact:ob-added-sugar",
    "fact:ob-ethanol",
    "fact:ob-prefer-whole-grains"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-030

簇：`disease:d:obesity`；划分：`development`。

输入候选：
```json
{
  "concern": "成人肥胖症",
  "scenario": "source_withdrawn"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:ob-fat",
    "fact:ob-fiber",
    "fact:ob-added-sugar",
    "fact:ob-ethanol",
    "fact:ob-prefer-whole-grains"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-031

簇：`disease:d:ckd`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人慢性肾脏病",
  "scenario": "conditions_missing"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:ck-protein",
    "fact:ck-sodium",
    "fact:ck-phosphorus",
    "fact:ck-potassium",
    "fact:ck-water"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-032

簇：`disease:d:ckd`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人慢性肾脏病",
  "scenario": "multiple_concerns"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:ck-protein",
    "fact:ck-sodium",
    "fact:ck-phosphorus",
    "fact:ck-potassium",
    "fact:ck-water"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-033

簇：`disease:d:ckd`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人慢性肾脏病",
  "scenario": "conflicting_advice"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:ck-protein",
    "fact:ck-sodium",
    "fact:ck-phosphorus",
    "fact:ck-potassium",
    "fact:ck-water"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-034

簇：`disease:d:ckd`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人慢性肾脏病",
  "scenario": "unknown_food_form"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:ck-protein",
    "fact:ck-sodium",
    "fact:ck-phosphorus",
    "fact:ck-potassium",
    "fact:ck-water"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-035

簇：`disease:d:ckd`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "成人慢性肾脏病",
  "scenario": "source_withdrawn"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:ck-protein",
    "fact:ck-sodium",
    "fact:ck-phosphorus",
    "fact:ck-potassium",
    "fact:ck-water"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-036

簇：`disease:d:primary-osteoporosis`；划分：`development`。

输入候选：
```json
{
  "concern": "成人原发性骨质疏松症",
  "scenario": "conditions_missing"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:op-calcium",
    "fact:op-vitamin-d",
    "fact:op-protein",
    "fact:op-sodium",
    "fact:op-caffeine"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-037

簇：`disease:d:primary-osteoporosis`；划分：`development`。

输入候选：
```json
{
  "concern": "成人原发性骨质疏松症",
  "scenario": "multiple_concerns"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:op-calcium",
    "fact:op-vitamin-d",
    "fact:op-protein",
    "fact:op-sodium",
    "fact:op-caffeine"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-038

簇：`disease:d:primary-osteoporosis`；划分：`development`。

输入候选：
```json
{
  "concern": "成人原发性骨质疏松症",
  "scenario": "conflicting_advice"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:op-calcium",
    "fact:op-vitamin-d",
    "fact:op-protein",
    "fact:op-sodium",
    "fact:op-caffeine"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-039

簇：`disease:d:primary-osteoporosis`；划分：`development`。

输入候选：
```json
{
  "concern": "成人原发性骨质疏松症",
  "scenario": "unknown_food_form"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:op-calcium",
    "fact:op-vitamin-d",
    "fact:op-protein",
    "fact:op-sodium",
    "fact:op-caffeine"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-040

簇：`disease:d:primary-osteoporosis`；划分：`development`。

输入候选：
```json
{
  "concern": "成人原发性骨质疏松症",
  "scenario": "source_withdrawn"
}
```

预期候选：
```json
{
  "sourceFactIds": [
    "fact:op-calcium",
    "fact:op-vitamin-d",
    "fact:op-protein",
    "fact:op-sodium",
    "fact:op-caffeine"
  ],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-041

簇：`disease:ambiguous-diabetes`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "糖尿病未分型",
  "scenario": "conditions_missing"
}
```

预期候选：
```json
{
  "sourceFactIds": [],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-042

簇：`disease:ambiguous-diabetes`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "糖尿病未分型",
  "scenario": "multiple_concerns"
}
```

预期候选：
```json
{
  "sourceFactIds": [],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-043

簇：`disease:ambiguous-diabetes`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "糖尿病未分型",
  "scenario": "conflicting_advice"
}
```

预期候选：
```json
{
  "sourceFactIds": [],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-044

簇：`disease:ambiguous-diabetes`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "糖尿病未分型",
  "scenario": "unknown_food_form"
}
```

预期候选：
```json
{
  "sourceFactIds": [],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-045

簇：`disease:ambiguous-diabetes`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "糖尿病未分型",
  "scenario": "source_withdrawn"
}
```

预期候选：
```json
{
  "sourceFactIds": [],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-046

簇：`disease:unsupported`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "本库未覆盖的疾病",
  "scenario": "conditions_missing"
}
```

预期候选：
```json
{
  "sourceFactIds": [],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-047

簇：`disease:unsupported`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "本库未覆盖的疾病",
  "scenario": "multiple_concerns"
}
```

预期候选：
```json
{
  "sourceFactIds": [],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-048

簇：`disease:unsupported`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "本库未覆盖的疾病",
  "scenario": "conflicting_advice"
}
```

预期候选：
```json
{
  "sourceFactIds": [],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-049

簇：`disease:unsupported`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "本库未覆盖的疾病",
  "scenario": "unknown_food_form"
}
```

预期候选：
```json
{
  "sourceFactIds": [],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。

## disease-050

簇：`disease:unsupported`；划分：`holdout_candidate`。

输入候选：
```json
{
  "concern": "本库未覆盖的疾病",
  "scenario": "source_withdrawn"
}
```

预期候选：
```json
{
  "sourceFactIds": [],
  "clinicalApproval": false,
  "noCureClaim": true,
  "unknownIsNotSafe": true,
  "requiresQualifiedReview": true
}
```

审核需填写：最终具体输入、来源复核、标签修订、审核者、分歧裁决与审核日期。实际输出及质量结论等待真实执行。
