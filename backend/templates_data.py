"""GymBuddy workout plan templates.

Predefined professional plans described as metadata + a day blueprint of
(pattern, muscle_focus, exercise_type) slots. The server fills each slot with
concrete exercises the user actually owns equipment for.
"""
from __future__ import annotations
from typing import Dict, List


def _n(en, de, es, fr, it):
    return {"en": en, "de": de, "es": es, "fr": fr, "it": it}


# A slot: pick an exercise matching (category, primary muscle group set, type)
# muscles: list of acceptable primary muscles; prefer compound for main lifts.
def slot(muscles, ex_type="any", count=1):
    return {"muscles": muscles, "type": ex_type, "count": count}


TEMPLATES: List[dict] = [
    {
        "id": "full_body_3",
        "name": _n("Full Body 3x", "Ganzkörper 3x", "Cuerpo Completo 3x", "Full Body 3x", "Full Body 3x"),
        "description": _n("Balanced full-body split, 3 days a week.", "Ausgewogener Ganzkörper-Split, 3 Tage pro Woche.", "Split de cuerpo completo, 3 días por semana.", "Split full body, 3 jours par semaine.", "Split total, 3 giorni a settimana."),
        "goal": ["build_muscle", "general_health", "improve_fitness", "lose_weight"],
        "experience": ["beginner", "intermediate"],
        "days_per_week": 3,
        "tags": ["full_body", "beginner"],
        "days": [
            {"name": _n("Full Body A", "Ganzkörper A", "Cuerpo A", "Full Body A", "Total A"), "slots": [
                slot(["quadriceps", "glutes"], "compound"), slot(["chest"], "compound"),
                slot(["lats", "upper_back"], "compound"), slot(["side_delt", "front_delt"], "isolation"),
                slot(["abs", "obliques"], "isolation")]},
            {"name": _n("Full Body B", "Ganzkörper B", "Cuerpo B", "Full Body B", "Total B"), "slots": [
                slot(["hamstrings", "glutes"], "compound"), slot(["front_delt", "chest"], "compound"),
                slot(["upper_back", "lats"], "compound"), slot(["biceps"], "isolation"),
                slot(["triceps"], "isolation")]},
            {"name": _n("Full Body C", "Ganzkörper C", "Cuerpo C", "Full Body C", "Total C"), "slots": [
                slot(["quadriceps", "glutes"], "compound"), slot(["chest", "front_delt"], "compound"),
                slot(["lats", "upper_back"], "compound"), slot(["calves"], "isolation"),
                slot(["abs"], "isolation")]},
        ],
    },
    {
        "id": "upper_lower_4",
        "name": _n("Upper / Lower 4x", "Ober / Unter 4x", "Superior / Inferior 4x", "Haut / Bas 4x", "Upper / Lower 4x"),
        "description": _n("Four-day upper/lower split for size and strength.", "Vier-Tage Ober/Unter-Split für Masse und Kraft.", "Split superior/inferior de cuatro días.", "Split haut/bas sur quatre jours.", "Split upper/lower su quattro giorni."),
        "goal": ["build_muscle", "gain_strength"],
        "experience": ["intermediate", "advanced"],
        "days_per_week": 4,
        "tags": ["upper_lower"],
        "days": [
            {"name": _n("Upper A", "Ober A", "Superior A", "Haut A", "Upper A"), "slots": [
                slot(["chest"], "compound"), slot(["upper_back", "lats"], "compound"),
                slot(["front_delt"], "compound"), slot(["side_delt"], "isolation"),
                slot(["biceps"], "isolation"), slot(["triceps"], "isolation")]},
            {"name": _n("Lower A", "Unter A", "Inferior A", "Bas A", "Lower A"), "slots": [
                slot(["quadriceps"], "compound"), slot(["hamstrings", "glutes"], "compound"),
                slot(["quadriceps"], "isolation"), slot(["hamstrings"], "isolation"),
                slot(["calves"], "isolation"), slot(["abs"], "isolation")]},
            {"name": _n("Upper B", "Ober B", "Superior B", "Haut B", "Upper B"), "slots": [
                slot(["front_delt", "chest"], "compound"), slot(["lats"], "compound"),
                slot(["upper_back"], "compound"), slot(["rear_delt"], "isolation"),
                slot(["triceps"], "isolation"), slot(["biceps"], "isolation")]},
            {"name": _n("Lower B", "Unter B", "Inferior B", "Bas B", "Lower B"), "slots": [
                slot(["glutes", "hamstrings"], "compound"), slot(["quadriceps"], "compound"),
                slot(["glutes"], "isolation"), slot(["calves"], "isolation"),
                slot(["obliques"], "isolation")]},
        ],
    },
    {
        "id": "ppl_6",
        "name": _n("Push / Pull / Legs 6x", "Push / Pull / Beine 6x", "Empuje / Tirón / Pierna 6x", "Push / Pull / Legs 6x", "Push / Pull / Gambe 6x"),
        "description": _n("High-volume PPL for advanced hypertrophy.", "Push/Pull/Legs mit hohem Volumen für Fortgeschrittene.", "PPL de alto volumen para hipertrofia avanzada.", "PPL à haut volume pour hypertrophie avancée.", "PPL ad alto volume per ipertrofia avanzata."),
        "goal": ["build_muscle", "gain_strength"],
        "experience": ["advanced", "intermediate"],
        "days_per_week": 6,
        "tags": ["ppl", "hypertrophy"],
        "days": [
            {"name": _n("Push", "Push", "Empuje", "Push", "Push"), "slots": [
                slot(["chest"], "compound"), slot(["front_delt"], "compound"),
                slot(["chest"], "isolation"), slot(["side_delt"], "isolation"),
                slot(["triceps"], "isolation"), slot(["triceps"], "isolation")]},
            {"name": _n("Pull", "Pull", "Tirón", "Pull", "Pull"), "slots": [
                slot(["lats"], "compound"), slot(["upper_back"], "compound"),
                slot(["rear_delt"], "isolation"), slot(["traps"], "isolation"),
                slot(["biceps"], "isolation"), slot(["biceps"], "isolation")]},
            {"name": _n("Legs", "Beine", "Pierna", "Legs", "Gambe"), "slots": [
                slot(["quadriceps"], "compound"), slot(["hamstrings", "glutes"], "compound"),
                slot(["quadriceps"], "isolation"), slot(["hamstrings"], "isolation"),
                slot(["calves"], "isolation"), slot(["abs"], "isolation")]},
            {"name": _n("Push", "Push", "Empuje", "Push", "Push"), "slots": [
                slot(["front_delt", "chest"], "compound"), slot(["chest"], "compound"),
                slot(["side_delt"], "isolation"), slot(["triceps"], "isolation"),
                slot(["chest"], "isolation")]},
            {"name": _n("Pull", "Pull", "Tirón", "Pull", "Pull"), "slots": [
                slot(["upper_back"], "compound"), slot(["lats"], "compound"),
                slot(["rear_delt"], "isolation"), slot(["biceps"], "isolation"),
                slot(["forearms"], "isolation")]},
            {"name": _n("Legs", "Beine", "Pierna", "Legs", "Gambe"), "slots": [
                slot(["hamstrings", "glutes"], "compound"), slot(["quadriceps"], "compound"),
                slot(["glutes"], "isolation"), slot(["calves"], "isolation"),
                slot(["obliques"], "isolation")]},
        ],
    },
    {
        "id": "push_pull_4",
        "name": _n("Push / Pull 4x", "Push / Pull 4x", "Empuje / Tirón 4x", "Push / Pull 4x", "Push / Pull 4x"),
        "description": _n("Four-day push/pull with legs folded in.", "Vier-Tage Push/Pull inklusive Beine.", "Push/pull de cuatro días con pierna incluida.", "Push/pull sur quatre jours avec jambes.", "Push/pull su quattro giorni con gambe."),
        "goal": ["build_muscle", "improve_fitness"],
        "experience": ["intermediate"],
        "days_per_week": 4,
        "tags": ["push_pull"],
        "days": [
            {"name": _n("Push", "Push", "Empuje", "Push", "Push"), "slots": [
                slot(["chest"], "compound"), slot(["front_delt"], "compound"),
                slot(["quadriceps"], "compound"), slot(["side_delt"], "isolation"),
                slot(["triceps"], "isolation")]},
            {"name": _n("Pull", "Pull", "Tirón", "Pull", "Pull"), "slots": [
                slot(["lats"], "compound"), slot(["upper_back"], "compound"),
                slot(["hamstrings", "glutes"], "compound"), slot(["biceps"], "isolation"),
                slot(["abs"], "isolation")]},
            {"name": _n("Push", "Push", "Empuje", "Push", "Push"), "slots": [
                slot(["front_delt"], "compound"), slot(["chest"], "compound"),
                slot(["quadriceps"], "isolation"), slot(["triceps"], "isolation"),
                slot(["calves"], "isolation")]},
            {"name": _n("Pull", "Pull", "Tirón", "Pull", "Pull"), "slots": [
                slot(["upper_back"], "compound"), slot(["lats"], "compound"),
                slot(["hamstrings"], "isolation"), slot(["biceps"], "isolation"),
                slot(["rear_delt"], "isolation")]},
        ],
    },
    {
        "id": "bodyweight_home",
        "name": _n("Bodyweight Only", "Nur Körpergewicht", "Solo Peso Corporal", "Poids du Corps", "Solo Corpo Libero"),
        "description": _n("No equipment needed, train anywhere.", "Kein Equipment nötig, trainiere überall.", "Sin equipo, entrena donde sea.", "Sans matériel, entraînez-vous partout.", "Senza attrezzi, allenati ovunque."),
        "goal": ["lose_weight", "general_health", "improve_fitness", "maintain_weight"],
        "experience": ["beginner", "intermediate"],
        "days_per_week": 3,
        "tags": ["bodyweight", "home"],
        "days": [
            {"name": _n("Day 1", "Tag 1", "Día 1", "Jour 1", "Giorno 1"), "slots": [
                slot(["chest"], "compound"), slot(["quadriceps", "glutes"], "compound"),
                slot(["abs"], "isolation"), slot(["obliques"], "isolation")]},
            {"name": _n("Day 2", "Tag 2", "Día 2", "Jour 2", "Giorno 2"), "slots": [
                slot(["lats"], "compound"), slot(["glutes", "hamstrings"], "compound"),
                slot(["abs"], "isolation"), slot(["cardio"], "cardio")]},
            {"name": _n("Day 3", "Tag 3", "Día 3", "Jour 3", "Giorno 3"), "slots": [
                slot(["quadriceps"], "compound"), slot(["chest", "triceps"], "compound"),
                slot(["abs", "hip_flexors"], "isolation"), slot(["full_body"], "compound")]},
        ],
    },
    {
        "id": "dumbbell_only_4",
        "name": _n("Dumbbell Only 4x", "Nur Kurzhanteln 4x", "Solo Mancuernas 4x", "Haltères Seulement 4x", "Solo Manubri 4x"),
        "description": _n("Full program using only a pair of dumbbells.", "Komplettes Programm nur mit Kurzhanteln.", "Programa completo solo con mancuernas.", "Programme complet avec haltères uniquement.", "Programma completo solo con manubri."),
        "goal": ["build_muscle", "general_health"],
        "experience": ["beginner", "intermediate"],
        "days_per_week": 4,
        "tags": ["dumbbell", "home"],
        "days": [
            {"name": _n("Upper", "Ober", "Superior", "Haut", "Upper"), "slots": [
                slot(["chest"], "compound"), slot(["upper_back", "lats"], "compound"),
                slot(["front_delt"], "compound"), slot(["biceps"], "isolation"),
                slot(["triceps"], "isolation")]},
            {"name": _n("Lower", "Unter", "Inferior", "Bas", "Lower"), "slots": [
                slot(["quadriceps", "glutes"], "compound"), slot(["hamstrings", "glutes"], "compound"),
                slot(["quadriceps"], "compound"), slot(["calves"], "isolation"),
                slot(["abs"], "isolation")]},
            {"name": _n("Upper", "Ober", "Superior", "Haut", "Upper"), "slots": [
                slot(["front_delt", "chest"], "compound"), slot(["lats"], "compound"),
                slot(["side_delt"], "isolation"), slot(["biceps"], "isolation"),
                slot(["triceps"], "isolation")]},
            {"name": _n("Lower", "Unter", "Inferior", "Bas", "Lower"), "slots": [
                slot(["hamstrings", "glutes"], "compound"), slot(["quadriceps"], "compound"),
                slot(["glutes"], "compound"), slot(["calves"], "isolation"),
                slot(["obliques"], "isolation")]},
        ],
    },
    {
        "id": "strength_5x5",
        "name": _n("Strength 5x5", "Kraft 5x5", "Fuerza 5x5", "Force 5x5", "Forza 5x5"),
        "description": _n("Classic barbell strength on the big lifts.", "Klassisches Langhantel-Krafttraining an den Grundübungen.", "Fuerza clásica con barra en los básicos.", "Force classique à la barre sur les gros mouvements.", "Forza classica con bilanciere sui grandi esercizi."),
        "goal": ["gain_strength", "build_muscle"],
        "experience": ["intermediate", "advanced"],
        "days_per_week": 3,
        "tags": ["strength", "gym"],
        "days": [
            {"name": _n("Workout A", "Training A", "Sesión A", "Séance A", "Sessione A"), "slots": [
                slot(["quadriceps", "glutes"], "compound"), slot(["chest"], "compound"),
                slot(["upper_back", "lats"], "compound")]},
            {"name": _n("Workout B", "Training B", "Sesión B", "Séance B", "Sessione B"), "slots": [
                slot(["quadriceps", "glutes"], "compound"), slot(["front_delt"], "compound"),
                slot(["lower_back", "hamstrings"], "compound")]},
            {"name": _n("Workout A", "Training A", "Sesión A", "Séance A", "Sessione A"), "slots": [
                slot(["quadriceps", "glutes"], "compound"), slot(["chest"], "compound"),
                slot(["upper_back", "lats"], "compound")]},
        ],
    },
    {
        "id": "weight_loss_5",
        "name": _n("Weight Loss Circuit 5x", "Abnehm-Zirkel 5x", "Circuito Pérdida 5x", "Circuit Minceur 5x", "Circuito Dimagrante 5x"),
        "description": _n("High-intensity circuits mixing strength and cardio.", "Intensive Zirkel aus Kraft und Ausdauer.", "Circuitos intensos de fuerza y cardio.", "Circuits intenses mêlant force et cardio.", "Circuiti intensi tra forza e cardio."),
        "goal": ["lose_weight", "improve_fitness"],
        "experience": ["beginner", "intermediate"],
        "days_per_week": 5,
        "tags": ["weight_loss", "cardio"],
        "days": [
            {"name": _n("Circuit 1", "Zirkel 1", "Circuito 1", "Circuit 1", "Circuito 1"), "slots": [
                slot(["full_body"], "compound"), slot(["quadriceps", "glutes"], "compound"),
                slot(["chest"], "compound"), slot(["cardio"], "cardio"), slot(["abs"], "isolation")]},
            {"name": _n("Circuit 2", "Zirkel 2", "Circuito 2", "Circuit 2", "Circuito 2"), "slots": [
                slot(["lats", "upper_back"], "compound"), slot(["hamstrings", "glutes"], "compound"),
                slot(["front_delt"], "compound"), slot(["cardio"], "cardio"), slot(["obliques"], "isolation")]},
            {"name": _n("Cardio", "Ausdauer", "Cardio", "Cardio", "Cardio"), "slots": [
                slot(["cardio"], "cardio"), slot(["cardio"], "cardio"), slot(["abs"], "isolation")]},
            {"name": _n("Circuit 3", "Zirkel 3", "Circuito 3", "Circuit 3", "Circuito 3"), "slots": [
                slot(["full_body"], "compound"), slot(["quadriceps"], "compound"),
                slot(["chest", "triceps"], "compound"), slot(["cardio"], "cardio"), slot(["abs"], "isolation")]},
            {"name": _n("Circuit 4", "Zirkel 4", "Circuito 4", "Circuit 4", "Circuito 4"), "slots": [
                slot(["glutes", "hamstrings"], "compound"), slot(["lats"], "compound"),
                slot(["side_delt"], "isolation"), slot(["cardio"], "cardio"), slot(["obliques"], "isolation")]},
        ],
    },
]

GOALS = {
    "lose_weight": _n("Lose Weight", "Abnehmen", "Perder Peso", "Perdre du Poids", "Perdere Peso"),
    "build_muscle": _n("Build Muscle", "Muskeln Aufbauen", "Ganar Músculo", "Prendre du Muscle", "Aumentare Massa"),
    "gain_strength": _n("Gain Strength", "Kraft Steigern", "Ganar Fuerza", "Gagner en Force", "Aumentare Forza"),
    "improve_fitness": _n("Improve Fitness", "Fitness Verbessern", "Mejorar Condición", "Améliorer la Forme", "Migliorare la Forma"),
    "maintain_weight": _n("Maintain Weight", "Gewicht Halten", "Mantener Peso", "Maintenir le Poids", "Mantenere il Peso"),
    "general_health": _n("General Health", "Allgemeine Gesundheit", "Salud General", "Santé Générale", "Salute Generale"),
}

EXPERIENCE = {
    "beginner": _n("Beginner", "Anfänger", "Principiante", "Débutant", "Principiante"),
    "intermediate": _n("Intermediate", "Fortgeschritten", "Intermedio", "Intermédiaire", "Intermedio"),
    "advanced": _n("Advanced", "Profi", "Avanzado", "Avancé", "Avanzato"),
}
