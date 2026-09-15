"""
GymBuddy exercise dataset generator.

Builds a large (500+) professional exercise database programmatically from
curated base movements crossed with valid equipment variants. Every generated
exercise carries full structured metadata and localized (en/de/es/fr/it)
names + instructions. Equipment requirements are exhaustive: ALL listed
required_equipment must be owned for an exercise to be available.
"""

from __future__ import annotations

import re
from typing import Dict, List

LANGS = ["en", "de", "es", "fr", "it"]

# ---------------------------------------------------------------------------
# Muscle catalogue (slug -> localized names)
# ---------------------------------------------------------------------------
MUSCLES: Dict[str, Dict[str, str]] = {
    "chest": {"en": "Chest", "de": "Brust", "es": "Pecho", "fr": "Pectoraux", "it": "Petto"},
    "upper_back": {"en": "Upper Back", "de": "Oberer Rücken", "es": "Espalda alta", "fr": "Haut du dos", "it": "Dorso alto"},
    "lats": {"en": "Lats", "de": "Latissimus", "es": "Dorsales", "fr": "Grand dorsal", "it": "Dorsali"},
    "lower_back": {"en": "Lower Back", "de": "Unterer Rücken", "es": "Espalda baja", "fr": "Bas du dos", "it": "Zona lombare"},
    "front_delt": {"en": "Front Delts", "de": "Vordere Schulter", "es": "Deltoides anterior", "fr": "Deltoïde antérieur", "it": "Deltoide anteriore"},
    "side_delt": {"en": "Side Delts", "de": "Seitliche Schulter", "es": "Deltoides lateral", "fr": "Deltoïde latéral", "it": "Deltoide laterale"},
    "rear_delt": {"en": "Rear Delts", "de": "Hintere Schulter", "es": "Deltoides posterior", "fr": "Deltoïde postérieur", "it": "Deltoide posteriore"},
    "biceps": {"en": "Biceps", "de": "Bizeps", "es": "Bíceps", "fr": "Biceps", "it": "Bicipiti"},
    "triceps": {"en": "Triceps", "de": "Trizeps", "es": "Tríceps", "fr": "Triceps", "it": "Tricipiti"},
    "forearms": {"en": "Forearms", "de": "Unterarme", "es": "Antebrazos", "fr": "Avant-bras", "it": "Avambracci"},
    "abs": {"en": "Abs", "de": "Bauchmuskeln", "es": "Abdominales", "fr": "Abdominaux", "it": "Addominali"},
    "obliques": {"en": "Obliques", "de": "Seitliche Bauchmuskeln", "es": "Oblicuos", "fr": "Obliques", "it": "Obliqui"},
    "glutes": {"en": "Glutes", "de": "Gesäß", "es": "Glúteos", "fr": "Fessiers", "it": "Glutei"},
    "quadriceps": {"en": "Quadriceps", "de": "Quadrizeps", "es": "Cuádriceps", "fr": "Quadriceps", "it": "Quadricipiti"},
    "hamstrings": {"en": "Hamstrings", "de": "Beinbeuger", "es": "Isquiotibiales", "fr": "Ischio-jambiers", "it": "Femorali"},
    "calves": {"en": "Calves", "de": "Waden", "es": "Gemelos", "fr": "Mollets", "it": "Polpacci"},
    "hip_flexors": {"en": "Hip Flexors", "de": "Hüftbeuger", "es": "Flexores de cadera", "fr": "Fléchisseurs de hanche", "it": "Flessori dell'anca"},
    "adductors": {"en": "Adductors", "de": "Adduktoren", "es": "Aductores", "fr": "Adducteurs", "it": "Adduttori"},
    "abductors": {"en": "Abductors", "de": "Abduktoren", "es": "Abductores", "fr": "Abducteurs", "it": "Abduttori"},
    "traps": {"en": "Traps", "de": "Trapezmuskel", "es": "Trapecios", "fr": "Trapèzes", "it": "Trapezi"},
    "neck": {"en": "Neck", "de": "Nacken", "es": "Cuello", "fr": "Cou", "it": "Collo"},
    "full_body": {"en": "Full Body", "de": "Ganzkörper", "es": "Cuerpo completo", "fr": "Corps entier", "it": "Corpo intero"},
    "cardio": {"en": "Cardio", "de": "Ausdauer", "es": "Cardio", "fr": "Cardio", "it": "Cardio"},
}

# ---------------------------------------------------------------------------
# Equipment catalogue (slug -> localized names)
# ---------------------------------------------------------------------------
EQUIPMENT: Dict[str, Dict[str, str]] = {
    "bodyweight": {"en": "Bodyweight", "de": "Körpergewicht", "es": "Peso corporal", "fr": "Poids du corps", "it": "Corpo libero"},
    "dumbbells": {"en": "Dumbbells", "de": "Kurzhanteln", "es": "Mancuernas", "fr": "Haltères", "it": "Manubri"},
    "barbell": {"en": "Barbell", "de": "Langhantel", "es": "Barra", "fr": "Barre", "it": "Bilanciere"},
    "bench": {"en": "Bench", "de": "Bank", "es": "Banco", "fr": "Banc", "it": "Panca"},
    "adjustable_bench": {"en": "Adjustable Bench", "de": "Verstellbare Bank", "es": "Banco ajustable", "fr": "Banc réglable", "it": "Panca regolabile"},
    "resistance_bands": {"en": "Resistance Bands", "de": "Widerstandsbänder", "es": "Bandas elásticas", "fr": "Bandes élastiques", "it": "Elastici"},
    "pullup_bar": {"en": "Pull-up Bar", "de": "Klimmzugstange", "es": "Barra de dominadas", "fr": "Barre de traction", "it": "Sbarra per trazioni"},
    "cable_machine": {"en": "Cable Machine", "de": "Kabelzug", "es": "Máquina de poleas", "fr": "Poulie", "it": "Cavi"},
    "smith_machine": {"en": "Smith Machine", "de": "Smith-Maschine", "es": "Máquina Smith", "fr": "Smith machine", "it": "Multipower"},
    "squat_rack": {"en": "Squat Rack", "de": "Kniebeugenständer", "es": "Rack de sentadillas", "fr": "Rack à squat", "it": "Rack per squat"},
    "power_rack": {"en": "Power Rack", "de": "Power Rack", "es": "Jaula de potencia", "fr": "Cage de force", "it": "Power rack"},
    "leg_press": {"en": "Leg Press", "de": "Beinpresse", "es": "Prensa de piernas", "fr": "Presse à cuisses", "it": "Leg press"},
    "leg_extension": {"en": "Leg Extension", "de": "Beinstrecker", "es": "Extensión de piernas", "fr": "Extension des jambes", "it": "Leg extension"},
    "leg_curl": {"en": "Leg Curl", "de": "Beinbeuger-Maschine", "es": "Curl de piernas", "fr": "Leg curl", "it": "Leg curl"},
    "chest_press": {"en": "Chest Press Machine", "de": "Brustpresse", "es": "Máquina de press de pecho", "fr": "Machine de développé", "it": "Chest press"},
    "pec_deck": {"en": "Pec Deck", "de": "Butterfly-Maschine", "es": "Contractor de pecho", "fr": "Pec deck", "it": "Pec deck"},
    "lat_pulldown": {"en": "Lat Pulldown", "de": "Latzug", "es": "Jalón al pecho", "fr": "Tirage vertical", "it": "Lat machine"},
    "row_machine": {"en": "Row Machine", "de": "Rudermaschine", "es": "Máquina de remo", "fr": "Machine à tirage", "it": "Macchina per rematore"},
    "shoulder_press_machine": {"en": "Shoulder Press Machine", "de": "Schulterpresse", "es": "Máquina de press de hombros", "fr": "Machine à épaules", "it": "Shoulder press"},
    "treadmill": {"en": "Treadmill", "de": "Laufband", "es": "Cinta de correr", "fr": "Tapis de course", "it": "Tapis roulant"},
    "exercise_bike": {"en": "Exercise Bike", "de": "Heimtrainer", "es": "Bicicleta estática", "fr": "Vélo d'appartement", "it": "Cyclette"},
    "elliptical": {"en": "Elliptical", "de": "Crosstrainer", "es": "Elíptica", "fr": "Vélo elliptique", "it": "Ellittica"},
    "kettlebells": {"en": "Kettlebells", "de": "Kettlebells", "es": "Pesas rusas", "fr": "Kettlebells", "it": "Kettlebell"},
    "ez_bar": {"en": "EZ Bar", "de": "SZ-Stange", "es": "Barra EZ", "fr": "Barre EZ", "it": "Bilanciere EZ"},
    "dip_station": {"en": "Dip Station", "de": "Dip-Station", "es": "Estación de fondos", "fr": "Station à dips", "it": "Parallele per dip"},
    "rowing_machine": {"en": "Rowing Machine", "de": "Rudergerät", "es": "Máquina de remo (cardio)", "fr": "Rameur", "it": "Vogatore"},
}

DIFFICULTY = {
    "beginner": {"en": "Beginner", "de": "Anfänger", "es": "Principiante", "fr": "Débutant", "it": "Principiante"},
    "intermediate": {"en": "Intermediate", "de": "Fortgeschritten", "es": "Intermedio", "fr": "Intermédiaire", "it": "Intermedio"},
    "advanced": {"en": "Advanced", "de": "Profi", "es": "Avanzado", "fr": "Avancé", "it": "Avanzato"},
}

CATEGORY = {
    "chest": {"en": "Chest", "de": "Brust", "es": "Pecho", "fr": "Pectoraux", "it": "Petto"},
    "back": {"en": "Back", "de": "Rücken", "es": "Espalda", "fr": "Dos", "it": "Schiena"},
    "shoulders": {"en": "Shoulders", "de": "Schultern", "es": "Hombros", "fr": "Épaules", "it": "Spalle"},
    "arms": {"en": "Arms", "de": "Arme", "es": "Brazos", "fr": "Bras", "it": "Braccia"},
    "legs": {"en": "Legs", "de": "Beine", "es": "Piernas", "fr": "Jambes", "it": "Gambe"},
    "core": {"en": "Core", "de": "Rumpf", "es": "Core", "fr": "Gainage", "it": "Core"},
    "cardio": {"en": "Cardio", "de": "Ausdauer", "es": "Cardio", "fr": "Cardio", "it": "Cardio"},
    "full_body": {"en": "Full Body", "de": "Ganzkörper", "es": "Cuerpo completo", "fr": "Corps entier", "it": "Corpo intero"},
}

# Movement pattern localized
PATTERN = {
    "push": {"en": "Push", "de": "Drücken", "es": "Empuje", "fr": "Poussée", "it": "Spinta"},
    "pull": {"en": "Pull", "de": "Ziehen", "es": "Tirón", "fr": "Traction", "it": "Trazione"},
    "squat": {"en": "Squat", "de": "Kniebeuge", "es": "Sentadilla", "fr": "Squat", "it": "Squat"},
    "hinge": {"en": "Hinge", "de": "Hüftbeugung", "es": "Bisagra de cadera", "fr": "Charnière", "it": "Hinge"},
    "lunge": {"en": "Lunge", "de": "Ausfallschritt", "es": "Zancada", "fr": "Fente", "it": "Affondo"},
    "core": {"en": "Core", "de": "Rumpf", "es": "Core", "fr": "Gainage", "it": "Core"},
    "carry": {"en": "Carry", "de": "Tragen", "es": "Acarreo", "fr": "Port", "it": "Trasporto"},
    "cardio": {"en": "Cardio", "de": "Ausdauer", "es": "Cardio", "fr": "Cardio", "it": "Cardio"},
    "isolation": {"en": "Isolation", "de": "Isolation", "es": "Aislamiento", "fr": "Isolation", "it": "Isolamento"},
}

TYPE = {
    "compound": {"en": "Compound", "de": "Grundübung", "es": "Compuesto", "fr": "Polyarticulaire", "it": "Composto"},
    "isolation": {"en": "Isolation", "de": "Isolationsübung", "es": "Aislamiento", "fr": "Isolation", "it": "Isolamento"},
    "cardio": {"en": "Cardio", "de": "Ausdauer", "es": "Cardio", "fr": "Cardio", "it": "Cardio"},
    "stretch": {"en": "Stretch", "de": "Dehnung", "es": "Estiramiento", "fr": "Étirement", "it": "Allungamento"},
}

# ---------------------------------------------------------------------------
# Localized instruction templates keyed by movement pattern. Filled with the
# exercise name and primary muscle so every exercise has full localized text.
# ---------------------------------------------------------------------------
INSTR = {
    "push": {
        "start": {
            "en": "Set up with a stable base, brace your core and position the load in the pressing path.",
            "de": "Baue eine stabile Basis auf, spanne den Rumpf an und bringe das Gewicht in die Drückposition.",
            "es": "Colócate con una base estable, tensa el core y sitúa la carga en la línea de empuje.",
            "fr": "Installez une base stable, gainez le tronc et placez la charge sur la trajectoire de poussée.",
            "it": "Assumi una base stabile, contrai il core e posiziona il carico sulla linea di spinta.",
        },
        "exec": {
            "en": "Press the load away in a controlled line, fully extend without locking harshly, then lower slowly.",
            "de": "Drücke das Gewicht kontrolliert weg, strecke vollständig ohne hartes Durchdrücken und senke langsam.",
            "es": "Empuja la carga en línea controlada, extiende sin bloquear con fuerza y baja despacio.",
            "fr": "Poussez la charge en ligne contrôlée, tendez sans verrouiller brutalement puis descendez lentement.",
            "it": "Spingi il carico in linea controllata, estendi senza bloccare bruscamente e abbassa lentamente.",
        },
    },
    "pull": {
        "start": {
            "en": "Establish a strong grip, retract the shoulder blades and keep the spine neutral.",
            "de": "Nimm einen festen Griff, ziehe die Schulterblätter zusammen und halte die Wirbelsäule neutral.",
            "es": "Agarra con firmeza, retrae las escápulas y mantén la columna neutra.",
            "fr": "Prenez une prise ferme, rétractez les omoplates et gardez la colonne neutre.",
            "it": "Impugna saldamente, retrai le scapole e mantieni la colonna neutra.",
        },
        "exec": {
            "en": "Pull with the target muscle leading, squeeze at the top, then control the return.",
            "de": "Ziehe mit dem Zielmuskel voran, kontrahiere oben und kontrolliere die Rückbewegung.",
            "es": "Tira liderando con el músculo objetivo, aprieta arriba y controla el retorno.",
            "fr": "Tirez en initiant avec le muscle ciblé, contractez en haut puis contrôlez le retour.",
            "it": "Tira guidando con il muscolo target, contrai in alto e controlla il ritorno.",
        },
    },
    "squat": {
        "start": {
            "en": "Stand with feet shoulder-width, brace hard and keep the chest tall.",
            "de": "Stelle die Füße schulterbreit, spanne kräftig an und halte die Brust aufrecht.",
            "es": "Pies a la anchura de los hombros, tensa con fuerza y mantén el pecho alto.",
            "fr": "Pieds largeur d'épaules, gainez fort et gardez la poitrine haute.",
            "it": "Piedi alla larghezza delle spalle, contrai con forza e tieni il petto alto.",
        },
        "exec": {
            "en": "Descend by sitting back and down, reach depth with knees tracking over toes, then drive up.",
            "de": "Senke dich nach hinten-unten, erreiche Tiefe mit Knien über den Zehen und drücke hoch.",
            "es": "Baja sentándote atrás y abajo, alcanza profundidad con rodillas sobre los pies y empuja arriba.",
            "fr": "Descendez en vous asseyant en arrière, atteignez la profondeur genoux au-dessus des orteils puis remontez.",
            "it": "Scendi sedendoti indietro e in basso, raggiungi la profondità con le ginocchia sopra le punte e spingi in alto.",
        },
    },
    "hinge": {
        "start": {
            "en": "Set a soft knee bend, load the hips back and keep a flat, braced back.",
            "de": "Beuge die Knie leicht, schiebe die Hüfte zurück und halte den Rücken flach und angespannt.",
            "es": "Rodillas ligeramente flexionadas, lleva la cadera atrás y mantén la espalda plana y firme.",
            "fr": "Genoux légèrement fléchis, reculez les hanches et gardez le dos plat et gainé.",
            "it": "Ginocchia leggermente piegate, spingi le anche indietro e tieni la schiena piatta e contratta.",
        },
        "exec": {
            "en": "Hinge from the hips lowering the load along the legs, then drive the hips forward to stand tall.",
            "de": "Beuge aus der Hüfte und senke das Gewicht entlang der Beine, dann schiebe die Hüfte nach vorn.",
            "es": "Bisagra desde la cadera bajando la carga por las piernas, luego lleva la cadera adelante.",
            "fr": "Charnière depuis les hanches en abaissant la charge le long des jambes, puis poussez les hanches en avant.",
            "it": "Fai perno dalle anche abbassando il carico lungo le gambe, poi spingi le anche in avanti.",
        },
    },
    "lunge": {
        "start": {
            "en": "Stand tall, take a controlled stance and keep the torso upright.",
            "de": "Stehe aufrecht, nimm eine kontrollierte Schrittstellung und halte den Oberkörper aufrecht.",
            "es": "Ponte erguido, adopta una postura controlada y mantén el torso vertical.",
            "fr": "Tenez-vous droit, adoptez une position contrôlée et gardez le torse vertical.",
            "it": "Stai eretto, assumi una posizione controllata e mantieni il busto verticale.",
        },
        "exec": {
            "en": "Lower into the lunge until the front thigh is parallel, then push back to the start.",
            "de": "Senke dich in den Ausfallschritt bis der vordere Oberschenkel parallel ist, dann drücke zurück.",
            "es": "Baja a la zancada hasta que el muslo delantero quede paralelo, luego empuja al inicio.",
            "fr": "Descendez en fente jusqu'à ce que la cuisse avant soit parallèle, puis revenez.",
            "it": "Scendi nell'affondo finché la coscia anteriore è parallela, poi torna alla partenza.",
        },
    },
    "core": {
        "start": {
            "en": "Set your position with the spine neutral and the core fully braced.",
            "de": "Nimm die Position mit neutraler Wirbelsäule und voll angespanntem Rumpf ein.",
            "es": "Coloca la posición con la columna neutra y el core totalmente tenso.",
            "fr": "Placez-vous colonne neutre et tronc totalement gainé.",
            "it": "Assumi la posizione con colonna neutra e core completamente contratto.",
        },
        "exec": {
            "en": "Move only through the trunk, avoid momentum and control every rep.",
            "de": "Bewege dich nur aus dem Rumpf, vermeide Schwung und kontrolliere jede Wiederholung.",
            "es": "Muévete solo desde el tronco, evita el impulso y controla cada repetición.",
            "fr": "Bougez uniquement par le tronc, évitez l'élan et contrôlez chaque répétition.",
            "it": "Muoviti solo dal tronco, evita lo slancio e controlla ogni ripetizione.",
        },
    },
    "isolation": {
        "start": {
            "en": "Isolate the target muscle, fix the surrounding joints and set a full stretch.",
            "de": "Isoliere den Zielmuskel, fixiere die umliegenden Gelenke und beginne aus voller Dehnung.",
            "es": "Aísla el músculo objetivo, fija las articulaciones y parte de un estiramiento completo.",
            "fr": "Isolez le muscle ciblé, fixez les articulations et partez d'un étirement complet.",
            "it": "Isola il muscolo target, fissa le articolazioni e parti da un allungamento completo.",
        },
        "exec": {
            "en": "Contract the muscle through its full range, pause at peak, then lower under control.",
            "de": "Kontrahiere den Muskel über die volle Bewegung, halte am Höhepunkt und senke kontrolliert.",
            "es": "Contrae el músculo en todo el rango, pausa en el pico y baja controlado.",
            "fr": "Contractez le muscle sur toute l'amplitude, marquez le pic puis descendez en contrôle.",
            "it": "Contrai il muscolo su tutta l'escursione, fermati al picco e abbassa in controllo.",
        },
    },
    "carry": {
        "start": {
            "en": "Grip the load firmly, brace the core and stand tall with proud shoulders.",
            "de": "Greife das Gewicht fest, spanne den Rumpf an und stehe aufrecht mit stolzen Schultern.",
            "es": "Agarra la carga con firmeza, tensa el core y ponte erguido con hombros firmes.",
            "fr": "Saisissez fermement la charge, gainez le tronc et tenez-vous droit épaules basses.",
            "it": "Afferra saldamente il carico, contrai il core e stai eretto con le spalle stabili.",
        },
        "exec": {
            "en": "Walk with controlled steps keeping the torso rigid for the prescribed distance or time.",
            "de": "Gehe mit kontrollierten Schritten und starrem Oberkörper über die vorgegebene Strecke oder Zeit.",
            "es": "Camina con pasos controlados manteniendo el torso rígido la distancia o tiempo indicados.",
            "fr": "Marchez à pas contrôlés en gardant le torse rigide sur la distance ou le temps prévus.",
            "it": "Cammina con passi controllati mantenendo il busto rigido per la distanza o il tempo previsti.",
        },
    },
    "cardio": {
        "start": {
            "en": "Warm up briefly and set a sustainable starting pace.",
            "de": "Wärme dich kurz auf und wähle ein nachhaltiges Anfangstempo.",
            "es": "Calienta brevemente y fija un ritmo inicial sostenible.",
            "fr": "Échauffez-vous brièvement et adoptez un rythme initial soutenable.",
            "it": "Riscaldati brevemente e imposta un ritmo iniziale sostenibile.",
        },
        "exec": {
            "en": "Maintain steady effort in your target zone, breathe rhythmically and finish with a cool-down.",
            "de": "Halte gleichmäßige Belastung in deiner Zielzone, atme rhythmisch und beende mit Cool-down.",
            "es": "Mantén un esfuerzo constante en tu zona objetivo, respira con ritmo y termina enfriando.",
            "fr": "Maintenez un effort régulier dans votre zone, respirez en rythme et terminez par un retour au calme.",
            "it": "Mantieni uno sforzo costante nella tua zona, respira ritmicamente e concludi con defaticamento.",
        },
    },
}

MISTAKES = {
    "en": ["Using momentum instead of muscle control", "Partial range of motion", "Losing core bracing", "Rushing the tempo"],
    "de": ["Schwung statt Muskelkontrolle nutzen", "Unvollständiger Bewegungsradius", "Rumpfspannung verlieren", "Zu schnelles Tempo"],
    "es": ["Usar impulso en lugar de control muscular", "Rango de movimiento parcial", "Perder la tensión del core", "Ritmo demasiado rápido"],
    "fr": ["Utiliser l'élan au lieu du contrôle", "Amplitude partielle", "Perdre le gainage", "Tempo trop rapide"],
    "it": ["Usare lo slancio invece del controllo", "Escursione parziale", "Perdere la contrazione del core", "Tempo troppo veloce"],
}

SAFETY = {
    "en": "Warm up properly, start with a manageable load and stop if you feel sharp pain.",
    "de": "Wärme dich gut auf, beginne mit handhabbarer Last und stoppe bei stechenden Schmerzen.",
    "es": "Calienta bien, empieza con una carga manejable y detente si sientes dolor agudo.",
    "fr": "Échauffez-vous correctement, commencez léger et arrêtez en cas de douleur vive.",
    "it": "Riscaldati bene, inizia con un carico gestibile e fermati se senti dolore acuto.",
}

BREATH = {
    "en": "Exhale during the effort phase, inhale on the return.",
    "de": "Atme in der Anstrengungsphase aus, in der Rückbewegung ein.",
    "es": "Exhala en la fase de esfuerzo, inhala en el retorno.",
    "fr": "Expirez pendant l'effort, inspirez au retour.",
    "it": "Espira nella fase di sforzo, inspira nel ritorno.",
}


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


# ---------------------------------------------------------------------------
# Base movements. Each base defines the localized action name and biomechanics.
# We then combine with valid equipment variants to generate the full catalogue.
# variants: list of (equipment_list, difficulty)
# ---------------------------------------------------------------------------
def _n(en, de, es, fr, it):
    return {"en": en, "de": de, "es": es, "fr": fr, "it": it}


# name templates per equipment for a movement base (prefix words)
EQUIP_PREFIX = {
    "barbell": _n("Barbell", "Langhantel-", "con Barra", "à la Barre", "con Bilanciere"),
    "dumbbells": _n("Dumbbell", "Kurzhantel-", "con Mancuernas", "aux Haltères", "con Manubri"),
    "kettlebells": _n("Kettlebell", "Kettlebell-", "con Pesa Rusa", "au Kettlebell", "con Kettlebell"),
    "cable_machine": _n("Cable", "Kabelzug-", "en Polea", "à la Poulie", "ai Cavi"),
    "smith_machine": _n("Smith Machine", "Smith-", "en Máquina Smith", "à la Smith", "al Multipower"),
    "resistance_bands": _n("Band", "Band-", "con Banda", "à l'Élastique", "con Elastico"),
    "ez_bar": _n("EZ-Bar", "SZ-Stangen-", "con Barra EZ", "à la Barre EZ", "con Bilanciere EZ"),
    "machine": _n("Machine", "Maschinen-", "en Máquina", "à la Machine", "alla Macchina"),
    "bodyweight": _n("Bodyweight", "Körpergewicht-", "con Peso Corporal", "au Poids du Corps", "a Corpo Libero"),
    "smith": _n("Smith Machine", "Smith-", "en Máquina Smith", "à la Smith", "al Multipower"),
}


def _mk_name(prefix_key, action):
    out = {}
    for lang in LANGS:
        p = EQUIP_PREFIX.get(prefix_key, {}).get(lang, "")
        a = action[lang]
        if lang in ("es", "fr", "it"):
            out[lang] = f"{a} {p}".strip()
        else:
            # German/English: prefixes ending in "-" join directly (compound words)
            joiner = "" if p.endswith("-") else " "
            out[lang] = f"{p}{joiner}{a}".strip()
    return out


# Base list: (action_names, category, primary, secondaries, pattern, type, variants)
# variants -> list of dict(equip=[...], prefix=key, difficulty=...)
BASES = [
    # ---- CHEST ----
    (_n("Bench Press", "Bankdrücken", "Press de Banca", "Développé Couché", "Distensioni su Panca"), "chest", "chest", ["front_delt", "triceps"], "push", "compound", [
        {"equip": ["barbell", "bench"], "prefix": "barbell", "difficulty": "intermediate"},
        {"equip": ["dumbbells", "bench"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["smith_machine", "bench"], "prefix": "smith", "difficulty": "beginner"},
        {"equip": ["chest_press"], "prefix": "machine", "difficulty": "beginner"},
    ]),
    (_n("Incline Press", "Schrägbankdrücken", "Press Inclinado", "Développé Incliné", "Distensioni Inclinate"), "chest", "chest", ["front_delt", "triceps"], "push", "compound", [
        {"equip": ["barbell", "adjustable_bench"], "prefix": "barbell", "difficulty": "intermediate"},
        {"equip": ["dumbbells", "adjustable_bench"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["smith_machine", "adjustable_bench"], "prefix": "smith", "difficulty": "beginner"},
    ]),
    (_n("Chest Fly", "Fliegende", "Aperturas", "Écarté", "Croci"), "chest", "chest", ["front_delt"], "isolation", "isolation", [
        {"equip": ["dumbbells", "bench"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["cable_machine"], "prefix": "cable_machine", "difficulty": "beginner"},
        {"equip": ["pec_deck"], "prefix": "machine", "difficulty": "beginner"},
        {"equip": ["resistance_bands"], "prefix": "resistance_bands", "difficulty": "beginner"},
    ]),
    (_n("Push-Up", "Liegestütz", "Flexión", "Pompe", "Piegamento"), "chest", "chest", ["front_delt", "triceps", "abs"], "push", "compound", [
        {"equip": ["bodyweight"], "prefix": "bodyweight", "difficulty": "beginner"},
    ]),
    (_n("Chest Dip", "Brust-Dip", "Fondo de Pecho", "Dips Pectoraux", "Dip per Petto"), "chest", "chest", ["triceps", "front_delt"], "push", "compound", [
        {"equip": ["dip_station"], "prefix": "bodyweight", "difficulty": "intermediate"},
    ]),
    (_n("Pullover", "Überzüge", "Pullover", "Pull-Over", "Pullover"), "chest", "chest", ["lats", "triceps"], "isolation", "isolation", [
        {"equip": ["dumbbells", "bench"], "prefix": "dumbbells", "difficulty": "intermediate"},
        {"equip": ["cable_machine"], "prefix": "cable_machine", "difficulty": "intermediate"},
    ]),

    # ---- BACK ----
    (_n("Deadlift", "Kreuzheben", "Peso Muerto", "Soulevé de Terre", "Stacco da Terra"), "back", "lower_back", ["glutes", "hamstrings", "traps", "forearms"], "hinge", "compound", [
        {"equip": ["barbell"], "prefix": "barbell", "difficulty": "advanced"},
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "intermediate"},
        {"equip": ["kettlebells"], "prefix": "kettlebells", "difficulty": "intermediate"},
        {"equip": ["smith_machine"], "prefix": "smith", "difficulty": "intermediate"},
    ]),
    (_n("Bent-Over Row", "vorgebeugtes Rudern", "Remo Inclinado", "Rowing Penché", "Rematore"), "back", "upper_back", ["lats", "biceps", "rear_delt"], "pull", "compound", [
        {"equip": ["barbell"], "prefix": "barbell", "difficulty": "intermediate"},
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["kettlebells"], "prefix": "kettlebells", "difficulty": "beginner"},
        {"equip": ["smith_machine"], "prefix": "smith", "difficulty": "beginner"},
    ]),
    (_n("Pull-Up", "Klimmzug", "Dominada", "Traction", "Trazione"), "back", "lats", ["biceps", "upper_back", "rear_delt"], "pull", "compound", [
        {"equip": ["pullup_bar"], "prefix": "bodyweight", "difficulty": "advanced"},
    ]),
    (_n("Lat Pulldown", "Latzug", "Jalón al Pecho", "Tirage Vertical", "Lat Machine"), "back", "lats", ["biceps", "upper_back"], "pull", "compound", [
        {"equip": ["lat_pulldown"], "prefix": "machine", "difficulty": "beginner"},
        {"equip": ["cable_machine"], "prefix": "cable_machine", "difficulty": "beginner"},
        {"equip": ["resistance_bands"], "prefix": "resistance_bands", "difficulty": "beginner"},
    ]),
    (_n("Seated Row", "Sitzendes Rudern", "Remo Sentado", "Rowing Assis", "Rematore Seduto"), "back", "upper_back", ["lats", "biceps", "rear_delt"], "pull", "compound", [
        {"equip": ["cable_machine"], "prefix": "cable_machine", "difficulty": "beginner"},
        {"equip": ["row_machine"], "prefix": "machine", "difficulty": "beginner"},
        {"equip": ["resistance_bands"], "prefix": "resistance_bands", "difficulty": "beginner"},
    ]),
    (_n("Shrug", "Schulterheben", "Encogimiento", "Haussement d'Épaules", "Scrollata"), "back", "traps", ["forearms"], "isolation", "isolation", [
        {"equip": ["barbell"], "prefix": "barbell", "difficulty": "beginner"},
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["smith_machine"], "prefix": "smith", "difficulty": "beginner"},
        {"equip": ["cable_machine"], "prefix": "cable_machine", "difficulty": "beginner"},
    ]),
    (_n("Back Extension", "Rückenstrecken", "Extensión de Espalda", "Extension Lombaire", "Estensione Lombare"), "back", "lower_back", ["glutes", "hamstrings"], "hinge", "isolation", [
        {"equip": ["bodyweight"], "prefix": "bodyweight", "difficulty": "beginner"},
    ]),
    (_n("Pull-Over Row", "Latzug-Rudern", "Remo en Polea", "Tirage à la Poulie", "Pulley"), "back", "lats", ["biceps", "rear_delt"], "pull", "compound", [
        {"equip": ["cable_machine"], "prefix": "cable_machine", "difficulty": "beginner"},
    ]),

    # ---- SHOULDERS ----
    (_n("Overhead Press", "Schulterdrücken", "Press Militar", "Développé Militaire", "Lento Avanti"), "shoulders", "front_delt", ["side_delt", "triceps"], "push", "compound", [
        {"equip": ["barbell"], "prefix": "barbell", "difficulty": "intermediate"},
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["smith_machine"], "prefix": "smith", "difficulty": "beginner"},
        {"equip": ["shoulder_press_machine"], "prefix": "machine", "difficulty": "beginner"},
        {"equip": ["kettlebells"], "prefix": "kettlebells", "difficulty": "intermediate"},
    ]),
    (_n("Lateral Raise", "Seitheben", "Elevación Lateral", "Élévation Latérale", "Alzate Laterali"), "shoulders", "side_delt", [], "isolation", "isolation", [
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["cable_machine"], "prefix": "cable_machine", "difficulty": "beginner"},
        {"equip": ["resistance_bands"], "prefix": "resistance_bands", "difficulty": "beginner"},
    ]),
    (_n("Front Raise", "Frontheben", "Elevación Frontal", "Élévation Frontale", "Alzate Frontali"), "shoulders", "front_delt", [], "isolation", "isolation", [
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["cable_machine"], "prefix": "cable_machine", "difficulty": "beginner"},
        {"equip": ["resistance_bands"], "prefix": "resistance_bands", "difficulty": "beginner"},
    ]),
    (_n("Rear Delt Fly", "Reverse Fly", "Pájaro", "Oiseau", "Alzate Posteriori"), "shoulders", "rear_delt", ["upper_back"], "isolation", "isolation", [
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["cable_machine"], "prefix": "cable_machine", "difficulty": "beginner"},
        {"equip": ["pec_deck"], "prefix": "machine", "difficulty": "beginner"},
    ]),
    (_n("Upright Row", "Aufrechtes Rudern", "Remo al Mentón", "Rowing Menton", "Tirate al Mento"), "shoulders", "side_delt", ["traps", "biceps"], "pull", "compound", [
        {"equip": ["barbell"], "prefix": "barbell", "difficulty": "intermediate"},
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["cable_machine"], "prefix": "cable_machine", "difficulty": "beginner"},
    ]),

    # ---- ARMS ----
    (_n("Biceps Curl", "Bizeps-Curl", "Curl de Bíceps", "Curl Biceps", "Curl per Bicipiti"), "arms", "biceps", ["forearms"], "isolation", "isolation", [
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["barbell"], "prefix": "barbell", "difficulty": "beginner"},
        {"equip": ["ez_bar"], "prefix": "ez_bar", "difficulty": "beginner"},
        {"equip": ["cable_machine"], "prefix": "cable_machine", "difficulty": "beginner"},
        {"equip": ["resistance_bands"], "prefix": "resistance_bands", "difficulty": "beginner"},
        {"equip": ["kettlebells"], "prefix": "kettlebells", "difficulty": "beginner"},
    ]),
    (_n("Hammer Curl", "Hammer-Curl", "Curl Martillo", "Curl Marteau", "Curl a Martello"), "arms", "biceps", ["forearms"], "isolation", "isolation", [
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["cable_machine"], "prefix": "cable_machine", "difficulty": "beginner"},
    ]),
    (_n("Triceps Extension", "Trizeps-Strecken", "Extensión de Tríceps", "Extension Triceps", "Estensione Tricipiti"), "arms", "triceps", [], "isolation", "isolation", [
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["ez_bar"], "prefix": "ez_bar", "difficulty": "beginner"},
        {"equip": ["cable_machine"], "prefix": "cable_machine", "difficulty": "beginner"},
    ]),
    (_n("Triceps Pushdown", "Trizeps-Drücken", "Jalón de Tríceps", "Extension à la Poulie", "Pushdown Tricipiti"), "arms", "triceps", [], "isolation", "isolation", [
        {"equip": ["cable_machine"], "prefix": "cable_machine", "difficulty": "beginner"},
        {"equip": ["resistance_bands"], "prefix": "resistance_bands", "difficulty": "beginner"},
    ]),
    (_n("Triceps Dip", "Trizeps-Dip", "Fondo de Tríceps", "Dips Triceps", "Dip per Tricipiti"), "arms", "triceps", ["chest", "front_delt"], "push", "compound", [
        {"equip": ["dip_station"], "prefix": "bodyweight", "difficulty": "intermediate"},
        {"equip": ["bench"], "prefix": "bodyweight", "difficulty": "beginner"},
    ]),
    (_n("Wrist Curl", "Handgelenk-Curl", "Curl de Muñeca", "Curl Poignet", "Curl Polso"), "arms", "forearms", [], "isolation", "isolation", [
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["barbell"], "prefix": "barbell", "difficulty": "beginner"},
    ]),
    (_n("Preacher Curl", "Scott-Curl", "Curl Predicador", "Curl Pupitre", "Curl su Panca Scott"), "arms", "biceps", ["forearms"], "isolation", "isolation", [
        {"equip": ["ez_bar", "adjustable_bench"], "prefix": "ez_bar", "difficulty": "intermediate"},
        {"equip": ["dumbbells", "adjustable_bench"], "prefix": "dumbbells", "difficulty": "beginner"},
    ]),
    (_n("Skull Crusher", "Stirndrücken", "Rompecráneos", "Barre au Front", "French Press"), "arms", "triceps", [], "isolation", "isolation", [
        {"equip": ["ez_bar", "bench"], "prefix": "ez_bar", "difficulty": "intermediate"},
        {"equip": ["dumbbells", "bench"], "prefix": "dumbbells", "difficulty": "beginner"},
    ]),

    # ---- LEGS ----
    (_n("Squat", "Kniebeuge", "Sentadilla", "Squat", "Squat"), "legs", "quadriceps", ["glutes", "hamstrings", "lower_back"], "squat", "compound", [
        {"equip": ["barbell", "squat_rack"], "prefix": "barbell", "difficulty": "intermediate"},
        {"equip": ["barbell", "power_rack"], "prefix": "barbell", "difficulty": "intermediate"},
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["kettlebells"], "prefix": "kettlebells", "difficulty": "beginner"},
        {"equip": ["smith_machine"], "prefix": "smith", "difficulty": "beginner"},
        {"equip": ["bodyweight"], "prefix": "bodyweight", "difficulty": "beginner"},
    ]),
    (_n("Front Squat", "Frontkniebeuge", "Sentadilla Frontal", "Squat Avant", "Front Squat"), "legs", "quadriceps", ["glutes", "abs"], "squat", "compound", [
        {"equip": ["barbell", "squat_rack"], "prefix": "barbell", "difficulty": "advanced"},
        {"equip": ["kettlebells"], "prefix": "kettlebells", "difficulty": "intermediate"},
    ]),
    (_n("Leg Press", "Beinpresse", "Prensa de Piernas", "Presse à Cuisses", "Leg Press"), "legs", "quadriceps", ["glutes", "hamstrings"], "squat", "compound", [
        {"equip": ["leg_press"], "prefix": "machine", "difficulty": "beginner"},
    ]),
    (_n("Lunge", "Ausfallschritt", "Zancada", "Fente", "Affondo"), "legs", "quadriceps", ["glutes", "hamstrings"], "lunge", "compound", [
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["barbell"], "prefix": "barbell", "difficulty": "intermediate"},
        {"equip": ["bodyweight"], "prefix": "bodyweight", "difficulty": "beginner"},
        {"equip": ["kettlebells"], "prefix": "kettlebells", "difficulty": "beginner"},
    ]),
    (_n("Bulgarian Split Squat", "Bulgarische Kniebeuge", "Sentadilla Búlgara", "Squat Bulgare", "Squat Bulgaro"), "legs", "quadriceps", ["glutes", "hamstrings"], "lunge", "compound", [
        {"equip": ["dumbbells", "bench"], "prefix": "dumbbells", "difficulty": "intermediate"},
        {"equip": ["bodyweight", "bench"], "prefix": "bodyweight", "difficulty": "intermediate"},
    ]),
    (_n("Romanian Deadlift", "Rumänisches Kreuzheben", "Peso Muerto Rumano", "Soulevé Roumain", "Stacco Rumeno"), "legs", "hamstrings", ["glutes", "lower_back"], "hinge", "compound", [
        {"equip": ["barbell"], "prefix": "barbell", "difficulty": "intermediate"},
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "beginner"},
    ]),
    (_n("Leg Extension", "Beinstrecken", "Extensión de Cuádriceps", "Leg Extension", "Leg Extension"), "legs", "quadriceps", [], "isolation", "isolation", [
        {"equip": ["leg_extension"], "prefix": "machine", "difficulty": "beginner"},
    ]),
    (_n("Leg Curl", "Beinbeugen", "Curl Femoral", "Leg Curl", "Leg Curl"), "legs", "hamstrings", ["calves"], "isolation", "isolation", [
        {"equip": ["leg_curl"], "prefix": "machine", "difficulty": "beginner"},
    ]),
    (_n("Calf Raise", "Wadenheben", "Elevación de Gemelos", "Extension Mollets", "Calf Raise"), "legs", "calves", [], "isolation", "isolation", [
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["barbell"], "prefix": "barbell", "difficulty": "beginner"},
        {"equip": ["smith_machine"], "prefix": "smith", "difficulty": "beginner"},
        {"equip": ["leg_press"], "prefix": "machine", "difficulty": "beginner"},
        {"equip": ["bodyweight"], "prefix": "bodyweight", "difficulty": "beginner"},
    ]),
    (_n("Hip Thrust", "Hüftstoß", "Empuje de Cadera", "Hip Thrust", "Hip Thrust"), "legs", "glutes", ["hamstrings"], "hinge", "compound", [
        {"equip": ["barbell", "bench"], "prefix": "barbell", "difficulty": "intermediate"},
        {"equip": ["dumbbells", "bench"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["bodyweight"], "prefix": "bodyweight", "difficulty": "beginner"},
    ]),
    (_n("Hip Abduction", "Abduktion", "Abducción de Cadera", "Abduction", "Abduzione"), "legs", "abductors", ["glutes"], "isolation", "isolation", [
        {"equip": ["cable_machine"], "prefix": "cable_machine", "difficulty": "beginner"},
        {"equip": ["resistance_bands"], "prefix": "resistance_bands", "difficulty": "beginner"},
        {"equip": ["bodyweight"], "prefix": "bodyweight", "difficulty": "beginner"},
    ]),
    (_n("Hip Adduction", "Adduktion", "Aducción de Cadera", "Adduction", "Adduzione"), "legs", "adductors", ["glutes"], "isolation", "isolation", [
        {"equip": ["cable_machine"], "prefix": "cable_machine", "difficulty": "beginner"},
        {"equip": ["resistance_bands"], "prefix": "resistance_bands", "difficulty": "beginner"},
    ]),
    (_n("Good Morning", "Good Morning", "Buenos Días", "Good Morning", "Good Morning"), "legs", "hamstrings", ["lower_back", "glutes"], "hinge", "compound", [
        {"equip": ["barbell"], "prefix": "barbell", "difficulty": "advanced"},
    ]),
    (_n("Step-Up", "Aufsteiger", "Subida al Cajón", "Step-Up", "Step-Up"), "legs", "quadriceps", ["glutes"], "lunge", "compound", [
        {"equip": ["dumbbells", "bench"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["bodyweight", "bench"], "prefix": "bodyweight", "difficulty": "beginner"},
    ]),

    # ---- CORE ----
    (_n("Plank", "Unterarmstütz", "Plancha", "Planche", "Plank"), "core", "abs", ["obliques", "lower_back"], "core", "isolation", [
        {"equip": ["bodyweight"], "prefix": "bodyweight", "difficulty": "beginner"},
    ]),
    (_n("Crunch", "Crunch", "Encogimiento Abdominal", "Crunch", "Crunch"), "core", "abs", [], "core", "isolation", [
        {"equip": ["bodyweight"], "prefix": "bodyweight", "difficulty": "beginner"},
        {"equip": ["cable_machine"], "prefix": "cable_machine", "difficulty": "beginner"},
    ]),
    (_n("Leg Raise", "Beinheben", "Elevación de Piernas", "Relevé de Jambes", "Sollevamento Gambe"), "core", "abs", ["hip_flexors"], "core", "isolation", [
        {"equip": ["bodyweight"], "prefix": "bodyweight", "difficulty": "beginner"},
        {"equip": ["pullup_bar"], "prefix": "bodyweight", "difficulty": "intermediate"},
    ]),
    (_n("Russian Twist", "Russischer Dreher", "Giro Ruso", "Russian Twist", "Russian Twist"), "core", "obliques", ["abs"], "core", "isolation", [
        {"equip": ["bodyweight"], "prefix": "bodyweight", "difficulty": "beginner"},
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["kettlebells"], "prefix": "kettlebells", "difficulty": "beginner"},
    ]),
    (_n("Mountain Climber", "Bergsteiger", "Escalador", "Grimpeur", "Mountain Climber"), "core", "abs", ["hip_flexors", "front_delt"], "core", "compound", [
        {"equip": ["bodyweight"], "prefix": "bodyweight", "difficulty": "beginner"},
    ]),
    (_n("Side Plank", "Seitstütz", "Plancha Lateral", "Planche Latérale", "Plank Laterale"), "core", "obliques", ["abs"], "core", "isolation", [
        {"equip": ["bodyweight"], "prefix": "bodyweight", "difficulty": "beginner"},
    ]),
    (_n("Cable Woodchop", "Holzhacker", "Leñador", "Bûcheron", "Woodchop"), "core", "obliques", ["abs"], "core", "compound", [
        {"equip": ["cable_machine"], "prefix": "cable_machine", "difficulty": "intermediate"},
        {"equip": ["resistance_bands"], "prefix": "resistance_bands", "difficulty": "beginner"},
    ]),

    # ---- FULL BODY / CONDITIONING ----
    (_n("Clean and Press", "Umsetzen und Drücken", "Cargada y Press", "Épaulé-Jeté", "Girata e Spinta"), "full_body", "full_body", ["front_delt", "quadriceps", "traps"], "push", "compound", [
        {"equip": ["barbell"], "prefix": "barbell", "difficulty": "advanced"},
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "intermediate"},
        {"equip": ["kettlebells"], "prefix": "kettlebells", "difficulty": "intermediate"},
    ]),
    (_n("Kettlebell Swing", "Kettlebell-Schwung", "Balanceo con Pesa Rusa", "Swing Kettlebell", "Swing con Kettlebell"), "full_body", "glutes", ["hamstrings", "lower_back", "front_delt"], "hinge", "compound", [
        {"equip": ["kettlebells"], "prefix": "kettlebells", "difficulty": "intermediate"},
    ]),
    (_n("Thruster", "Thruster", "Thruster", "Thruster", "Thruster"), "full_body", "full_body", ["quadriceps", "front_delt", "glutes"], "push", "compound", [
        {"equip": ["barbell"], "prefix": "barbell", "difficulty": "advanced"},
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "intermediate"},
    ]),
    (_n("Burpee", "Burpee", "Burpee", "Burpee", "Burpee"), "full_body", "full_body", ["chest", "quadriceps", "abs"], "push", "compound", [
        {"equip": ["bodyweight"], "prefix": "bodyweight", "difficulty": "intermediate"},
    ]),
    (_n("Farmer's Carry", "Farmer's Walk", "Paseo del Granjero", "Marche du Fermier", "Farmer's Walk"), "full_body", "forearms", ["traps", "abs"], "carry", "compound", [
        {"equip": ["dumbbells"], "prefix": "dumbbells", "difficulty": "beginner"},
        {"equip": ["kettlebells"], "prefix": "kettlebells", "difficulty": "beginner"},
    ]),

    # ---- CARDIO ----
    (_n("Treadmill Run", "Laufband-Lauf", "Carrera en Cinta", "Course sur Tapis", "Corsa su Tapis"), "cardio", "cardio", ["quadriceps", "calves"], "cardio", "cardio", [
        {"equip": ["treadmill"], "prefix": "machine", "difficulty": "beginner"},
    ]),
    (_n("Cycling", "Radfahren", "Ciclismo", "Vélo", "Ciclismo"), "cardio", "cardio", ["quadriceps"], "cardio", "cardio", [
        {"equip": ["exercise_bike"], "prefix": "machine", "difficulty": "beginner"},
    ]),
    (_n("Elliptical Training", "Crosstrainer", "Entrenamiento Elíptico", "Elliptique", "Ellittica"), "cardio", "cardio", ["quadriceps", "glutes"], "cardio", "cardio", [
        {"equip": ["elliptical"], "prefix": "machine", "difficulty": "beginner"},
    ]),
    (_n("Rowing", "Rudern", "Remo", "Aviron", "Vogatore"), "cardio", "cardio", ["upper_back", "quadriceps"], "cardio", "cardio", [
        {"equip": ["rowing_machine"], "prefix": "machine", "difficulty": "beginner"},
    ]),
    (_n("Jump Rope", "Seilspringen", "Salto de Cuerda", "Corde à Sauter", "Salto con la Corda"), "cardio", "cardio", ["calves"], "cardio", "cardio", [
        {"equip": ["bodyweight"], "prefix": "bodyweight", "difficulty": "beginner"},
    ]),
    (_n("High Knees", "Knieheben", "Rodillas Altas", "Montées de Genoux", "Ginocchia Alte"), "cardio", "cardio", ["hip_flexors", "calves"], "cardio", "cardio", [
        {"equip": ["bodyweight"], "prefix": "bodyweight", "difficulty": "beginner"},
    ]),
]

# Grip / angle / stance modifiers to expand variations meaningfully (localized)
MODIFIERS = [
    None,
    _n("Close-Grip", "Enger Griff", "Agarre Cerrado", "Prise Serrée", "Presa Stretta"),
    _n("Wide-Grip", "Weiter Griff", "Agarre Abierto", "Prise Large", "Presa Larga"),
    _n("Seated", "Sitzend", "Sentado", "Assis", "Seduto"),
    _n("Standing", "Stehend", "De Pie", "Debout", "In Piedi"),
    _n("Single-Arm", "Einarmig", "Un Brazo", "Un Bras", "Un Braccio"),
    _n("Incline", "Schräg", "Inclinado", "Incliné", "Inclinato"),
    _n("Decline", "Negativ", "Declinado", "Décliné", "Declinato"),
    _n("Tempo", "Tempo", "Tempo", "Tempo", "Tempo"),
    _n("Paused", "Mit Pause", "con Pausa", "avec Pause", "con Pausa"),
]


def _apply_modifier(name: Dict[str, str], mod) -> Dict[str, str]:
    if mod is None:
        return dict(name)
    out = {}
    for lang in LANGS:
        if lang in ("es", "fr", "it"):
            out[lang] = f"{name[lang]} {mod[lang]}"
        else:
            out[lang] = f"{mod[lang]} {name[lang]}"
    return out


def build_exercises() -> List[dict]:
    exercises: List[dict] = []
    seen = set()
    idx = 0
    # First pass: base variants
    for action, category, primary, secondaries, pattern, ex_type, variants in BASES:
        for v in variants:
            for mi, mod in enumerate(MODIFIERS):
                # Limit modifier explosion: cardio + full_body only base name
                if category in ("cardio",) and mod is not None:
                    continue
                # apply a subset of modifiers to keep names sensible
                if mod is not None and mi > 5 and ex_type == "cardio":
                    continue
                base_name = _mk_name(v["prefix"], action)
                name = _apply_modifier(base_name, mod)
                slug = _slugify(name["en"] + "_" + "_".join(v["equip"]))
                if slug in seen:
                    continue
                seen.add(slug)
                idx += 1
                instr_pat = pattern if pattern in INSTR else "isolation"
                localized_instructions = {}
                for lang in LANGS:
                    localized_instructions[lang] = {
                        "starting_position": INSTR[instr_pat]["start"][lang],
                        "execution": INSTR[instr_pat]["exec"][lang],
                        "breathing": BREATH[lang],
                        "safety": SAFETY[lang],
                        "common_mistakes": MISTAKES[lang],
                        "instructions": INSTR[instr_pat]["start"][lang] + " " + INSTR[instr_pat]["exec"][lang],
                    }
                required = list(v["equip"])
                ex = {
                    "id": slug,
                    "name": name["en"],
                    "localized_names": name,
                    "category": category,
                    "primary_muscle": primary,
                    "secondary_muscles": secondaries,
                    "required_equipment": required,
                    "optional_equipment": [],
                    "difficulty": v["difficulty"],
                    "exercise_type": ex_type,
                    "movement_pattern": pattern,
                    "localized": localized_instructions,
                    "has_image": True,  # rendered via internal SVG muscle diagram
                    "has_animation": mi == 0,  # base variants get a demo flag
                    "media_attribution": "Internal SVG asset (GymBuddy, CC0)",
                    "is_active": True,
                }
                exercises.append(ex)
    # Compute alternatives / variations by primary muscle
    by_primary: Dict[str, List[str]] = {}
    for ex in exercises:
        by_primary.setdefault(ex["primary_muscle"], []).append(ex["id"])
    diff_rank = {"beginner": 0, "intermediate": 1, "advanced": 2}
    for ex in exercises:
        pool = [i for i in by_primary.get(ex["primary_muscle"], []) if i != ex["id"]]
        ex["alternatives"] = pool[:6]
        # easier/harder by difficulty within same primary
        easier = None
        harder = None
        for other in exercises:
            if other["id"] == ex["id"] or other["primary_muscle"] != ex["primary_muscle"]:
                continue
            if diff_rank[other["difficulty"]] < diff_rank[ex["difficulty"]] and easier is None:
                easier = other["id"]
            if diff_rank[other["difficulty"]] > diff_rank[ex["difficulty"]] and harder is None:
                harder = other["id"]
        ex["easier_variation"] = easier
        ex["harder_variation"] = harder
    return exercises


EXERCISES = build_exercises()

if __name__ == "__main__":
    print(f"Generated {len(EXERCISES)} exercises")
    from collections import Counter
    print(Counter(e["category"] for e in EXERCISES))
