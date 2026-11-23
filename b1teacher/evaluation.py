"""The six-criterion rubric supplied by the learner (descriptors from 0 to 4)."""

RUBRIC = {
    "comprension": ("Comprensión del texto", ("Nula", "Limitada", "Suficiente", "Buena", "Excelente")),
    "expresion": ("Expresión oral", ("Insuficiente", "Difícil", "Comprensible", "Generalmente clara", "Fluida y clara")),
    "argumentacion": ("Argumentación", ("Ausente", "Escasa", "Simple", "Adecuada", "Muy desarrollada")),
    "vocabulario": ("Vocabulario", ("Insuficiente", "Repetitivo", "Suficiente", "Adecuado", "Amplio y preciso")),
    "gramatica": ("Corrección gramatical", ("Incomprensible", "Muchos errores", "Errores frecuentes", "Algunos errores", "Muy pocos errores")),
    "interaccion": ("Interacción", ("Nula", "Limitada", "Correcta", "Activa", "Participación excelente")),
}

EVALUATION_SCHEMA = {
    "type": "object",
    "properties": {
        key: {
            "type": "object",
            "properties": {
                "score": {"type": ["integer", "null"], "minimum": 0, "maximum": 4},
                "reason": {"type": "string"},
                "evidence": {"type": "string"},
            },
            "required": ["score", "reason", "evidence"],
            "additionalProperties": False,
        }
        for key in RUBRIC
    },
    "required": list(RUBRIC),
    "additionalProperties": False,
}


def validate_evaluation(data, learner_lines, has_reading):
    if not isinstance(data, dict) or set(data) != set(RUBRIC):
        raise ValueError("Unvollständige Bewertung")
    rows = []
    for key, (label, descriptors) in RUBRIC.items():
        item = data[key]
        score = item["score"]
        reason, evidence = item["reason"].strip(), item["evidence"].strip()
        if not reason or (score is not None and (type(score) is not int or not 0 <= score <= 4)):
            raise ValueError("Ungültige Bewertung")
        if key == "comprension" and not has_reading:
            score, evidence, reason = None, "", "Ohne Lesetext nicht bewertbar."
        if score is not None and (not evidence or not any(evidence in line for line in learner_lines)):
            raise ValueError("Bewertung ohne belegbare Aussage")
        rows.append({"key": key, "label": label, "score": score,
                     "descriptor": descriptors[score] if score is not None else "Nicht bewertbar",
                     "reason": reason[:600], "evidence": evidence if score is not None else ""})
    assessed = [row["score"] for row in rows if row["score"] is not None]
    return {"criteria": rows, "total": sum(assessed), "maximum": 4 * len(assessed)}
