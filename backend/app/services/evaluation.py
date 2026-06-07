from typing import Dict, List


def compute_metrics(results: List[Dict[str, object]]) -> Dict[str, object]:
    total = len(results)
    if total == 0:
        return {
            "cases": 0,
            "top_1_accuracy": 0,
            "top_3_accuracy": 0,
            "hub_filter_accuracy": 0,
            "false_positive_rate": 0,
        }

    top_1 = sum(1 for result in results if result["top_1_hit"])
    top_3 = sum(1 for result in results if result["top_3_hit"])
    hub_accuracy = sum(1 for result in results if result["hub_filter_correct"])
    false_positive_rate = sum(result["false_positive_count"] for result in results) / total

    return {
        "cases": total,
        "top_1_accuracy": round((top_1 / total) * 100, 2),
        "top_3_accuracy": round((top_3 / total) * 100, 2),
        "hub_filter_accuracy": round((hub_accuracy / total) * 100, 2),
        "false_positive_rate": round(false_positive_rate, 2),
    }
