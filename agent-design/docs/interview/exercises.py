"""Offline teaching examples, not production code or the project's evaluation."""
import json
import math


def rrf(channels, weights, c=60):
    if len(channels) != len(weights) or not math.isfinite(c) or c <= 0:
        raise ValueError("invalid channels or c")
    scores = {}
    for ranking, weight in zip(channels, weights):
        if not math.isfinite(weight) or weight <= 0:
            raise ValueError("invalid weight")
        # Deduplicate before assigning ranks; one vote per channel per ID.
        for rank, item in enumerate(dict.fromkeys(ranking), 1):
            scores[item] = scores.get(item, 0.0) + weight / (c + rank)
    return sorted(scores.items(), key=lambda item: (-item[1], item[0]))


def metrics(ranking, relevant, k=2):
    if not relevant or k < 1:
        raise ValueError("this exercise requires nonempty gold and k>=1")
    ranking = list(dict.fromkeys(ranking))
    recall = len(set(ranking[:k]) & relevant) / len(relevant)
    rr = next((1 / rank for rank, item in enumerate(ranking, 1)
               if item in relevant), 0.0)
    return {"recall_at_2": recall, "rr": rr}


def strict_choices(raw, allowed):
    def unique_pairs(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("duplicate key")
            result[key] = value
        return result

    def invalid_constant(value):
        raise ValueError("non-JSON numeric constant")

    value = json.loads(raw, object_pairs_hook=unique_pairs,
                       parse_constant=invalid_constant)
    if type(value) is not dict or set(value) != {"choices"}:
        raise ValueError("invalid object")
    choices = value["choices"]
    if type(choices) is not list or not choices or len(choices) > 18:
        raise ValueError("invalid choices")
    if any(type(item) is not str or item not in allowed for item in choices):
        raise ValueError("unknown or invalid ID")
    if len(set(choices)) != len(choices):
        raise ValueError("duplicate choice")
    return value


def main():
    ranks = {"a1": [["A", "X"], ["X", "B"]],
             "dense": [["X", "A"], ["B", "X"]]}
    gold = [{"A"}, {"B"}]
    ranks["hybrid"] = [[item for item, _ in rrf([a, d], [2, 1])]
                       for a, d in zip(ranks["a1"], ranks["dense"])]
    result = {"scope": "toy_only_no_project_quality_claim",
              "rrf_example": rrf([["A", "B"], ["C", "B", "A"]], [2, 1]),
              "mode_comparison": {}}
    for mode, rankings in ranks.items():
        rows = [metrics(ranking, answer) for ranking, answer in zip(rankings, gold)]
        result["mode_comparison"][mode] = {
            "recall_at_2": sum(row["recall_at_2"] for row in rows) / len(rows),
            "mrr": sum(row["rr"] for row in rows) / len(rows),
            "per_question": [{"ranking": ranking, **row}
                             for ranking, row in zip(rankings, rows)]}
    examples = {"valid": '{"choices":["c1"]}',
                "fenced": '```json\n{"choices":["c1"]}\n```',
                "truncated": '{"choices":["c1"',
                "duplicate_key": '{"choices":["c1"],"choices":["c2"]}',
                "outside_catalog": '{"choices":["unknown"]}'}
    result["json_cases"] = {}
    for name, raw in examples.items():
        try:
            strict_choices(raw, {"c1", "c2"})
            result["json_cases"][name] = "accepted"
        except ValueError:
            result["json_cases"][name] = "rejected"
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
