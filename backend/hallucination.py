def check_hallucination(summary, original_text):
    original_lower = original_text.lower()
    raw_sentences = summary.split(".")
    sentences = [
        s.strip() for s in raw_sentences
        if len(s.strip()) > 15
    ]
    if not sentences:
        return {
            "score": 0.0,
            "label": "Could not analyze",
            "color": "gray",
            "details": []
        }
    matched = 0
    details = []
    for sentence in sentences:
        words = sentence.lower().split()
        key_words = [w for w in words if len(w) > 5]
        if not key_words:
            continue
        found = sum(
            1 for word in key_words
            if word in original_lower
        )
        match_ratio = found / len(key_words)
        is_grounded = match_ratio > 0.25
        if is_grounded:
            matched += 1
        details.append({
            "sentence": sentence,
            "grounded": is_grounded,
            "match_ratio": round(match_ratio, 2)
        })
    total = len(details)
    score = round(matched / total, 2) if total > 0 else 0.0
    return {
        "score": score,
        "percentage": int(score * 100),
        "label": get_label(score),
        "color": get_color(score),
        "grounded_count": matched,
        "total_count": total,
        "details": details
    }

def get_label(score):
    if score >= 0.8:
        return "High Confidence — Summary is well grounded in document"
    elif score >= 0.5:
        return "Medium Confidence — Some points may not be in document"
    else:
        return "Low Confidence — Summary may contain hallucinated content"

def get_color(score):
    if score >= 0.8:
        return "green"
    elif score >= 0.5:
        return "yellow"
    else:
        return "red"