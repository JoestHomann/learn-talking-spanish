"""Original speaking tasks for the local B1 tutor."""

from .reading import READING_SCENARIOS

SCENARIOS = {
    "alltag": {
        "label": "Alltag",
        "description": "Erzähl Lucía von deinem Tag und frag sie nach ihrem.",
        "opening": "¡Hola! Hoy he salido a dar un paseo porque hacía buen tiempo. ¿Qué tal ha ido tu día?",
        "instructions": (
            "Conversación informal sobre el día, el tiempo o los planes. "
            "Eres una compañera de conversación y cuentas detalles de tu día ficticio cuando encaja. "
            "Dale espacio para preguntarte algo, reaccionar y seguir un tema de su elección."
        ),
    },
    "verhandlung": {
        "label": "Verhandlung",
        "description": "Plant einen Ausflug und einigt euch trotz unterschiedlicher Wünsche.",
        "opening": (
            "¿Organizamos una excursión para el sábado? No puedo salir antes de las once "
            "y parece que va a llover. ¿Qué propones?"
        ),
        "instructions": (
            "Simula que los dos organizáis una excursión el sábado. Habla como la otra persona: "
            "puedes salir a partir de las once y, si llueve, prefieres una actividad bajo techo. "
            "Mantén tus restricciones, pide un motivo o haz una contrapropuesta razonable. "
            "Si ambos aceptáis una opción, invita al estudiante a resumir el acuerdo. "
            "Practica propuestas, condiciones y concesiones en un contexto natural."
        ),
    },
    "familie-freunde": {
        "label": "Familie & Freundschaften",
        "area": "Persönliches",
        "format": "Kurzvortrag mit Rückfragen",
        "description": "Stell eine wichtige Person vor und erzähle von einem gemeinsamen Erlebnis.",
        "opening": "Vamos a hablar de una persona importante para ti. Preséntala y cuéntame una experiencia que hayáis compartido.",
        "points": (
            "Presenta a un amigo, una amiga o un familiar.",
            "Cuenta algo que os pasó juntos.",
            "Explica por qué esa persona es importante para ti.",
        ),
        "instructions": "Eres la entrevistadora. Tras la presentación, pregunta por un detalle concreto de la experiencia o por cómo mantienen el contacto.",
    },
    "freizeit-kultur": {
        "label": "Freizeit & Kultur",
        "area": "Persönliches",
        "format": "Gemeinsam planen",
        "description": "Einigt euch auf eine bezahlbare Aktivität für den Freitagabend.",
        "opening": "Tenemos la tarde del viernes libre. A mí me apetece ir al cine, pero no quiero gastar más de quince euros. ¿Qué te parece?",
        "points": (
            "Propón una actividad y explica por qué te gusta.",
            "Compara tu propuesta con la otra opción.",
            "Acuerda qué vais a hacer y a qué hora.",
        ),
        "instructions": "Eres una amiga. Dispones de quince euros y puedes quedar después de las seis. Haz una contrapropuesta si hace falta y respeta lo que ya se haya acordado.",
    },
    "gesundheit-ernaehrung": {
        "label": "Gesundheit & Ernährung",
        "area": "Persönliches",
        "format": "Erfahrungen und Meinung austauschen",
        "description": "Sprich über Essgewohnheiten und Bewegung im Alltag.",
        "opening": "Cuando tengo mucho trabajo, me cuesta comer con calma y hacer algo de ejercicio. ¿Qué hábitos te funcionan a ti?",
        "points": (
            "Describe un hábito que tengas relacionado con la comida o el ejercicio.",
            "Cuenta qué cambió durante una época ocupada.",
            "Propón un cambio sencillo y explica por qué podría funcionar.",
        ),
        "instructions": "Intercambia experiencias ficticias sobre hábitos cotidianos. Pregunta qué cambio sería más fácil de mantener y evita convertir el ejercicio en una consulta médica.",
    },
    "wohnen-nachbarschaft": {
        "label": "Wohnen & Nachbarschaft",
        "area": "Alltag und Öffentlichkeit",
        "format": "Rollenspiel",
        "description": "Sprich deine Nachbarin auf nächtlichen Lärm an und findet eine Lösung.",
        "opening": "Hola, soy Lucía, la vecina de arriba. Me dijiste que querías hablar conmigo de algo que pasó anoche. ¿Qué ocurre?",
        "points": (
            "Explica qué ruido oíste y cuándo.",
            "Di cómo te afectó, con un tono educado.",
            "Propón una solución y acuerda qué haréis la próxima vez.",
        ),
        "instructions": "Eres la vecina. Anoche tenías visita y no sabías que se oía desde abajo. Puedes bajar el volumen a partir de las diez, pero no cancelar la visita del sábado.",
    },
    "reisen-verkehr": {
        "label": "Reisen & Verkehr",
        "area": "Alltag und Öffentlichkeit",
        "format": "Rollenspiel",
        "description": "Du hast deinen Anschluss verpasst und brauchst eine Alternative.",
        "opening": "Buenos días. Está en la oficina de información de la estación. ¿En qué puedo ayudarle?",
        "points": (
            "Explica qué conexión perdiste y por qué.",
            "Pregunta por las alternativas, la hora de llegada y el precio.",
            "Elige una opción y confirma los detalles.",
        ),
        "instructions": "Trabajas en la estación. Ofrece un autobús a las 13:10 por 18 euros que tarda dos horas o un tren a las 14:00 por 26 euros que tarda una hora. Da la información que te pidan.",
    },
    "einkaufen-reklamieren": {
        "label": "Einkaufen & Reklamieren",
        "area": "Alltag und Öffentlichkeit",
        "format": "Rollenspiel",
        "description": "Reklamiere einen defekten Gegenstand und vereinbare eine Lösung.",
        "opening": "Buenos días. Soy la encargada de la tienda. ¿En qué puedo ayudarle?",
        "points": (
            "Di qué compraste y cuándo.",
            "Describe el problema y explica qué solución prefieres.",
            "Pregunta por las condiciones y acepta o propone otra solución.",
        ),
        "instructions": "Eres la encargada. Puedes cambiar el producto si queda en stock o tramitar una devolución con el recibo. Pide al cliente datos antes de ofrecer opciones y confirma la solución final.",
    },
    "umwelt-stadt": {
        "label": "Umwelt & Stadtleben",
        "area": "Alltag und Öffentlichkeit",
        "format": "Gemeinsam planen",
        "description": "Entscheidet, welche kleine Umweltaktion ihr im Viertel umsetzt.",
        "opening": "La asociación del barrio tiene treinta euros y dos horas el domingo para hacer algo por el medio ambiente. ¿Qué propones?",
        "points": (
            "Propón una actividad concreta.",
            "Compara tu idea con otra teniendo en cuenta el tiempo y el presupuesto.",
            "Acordad qué vais a hacer y repartid las tareas.",
        ),
        "instructions": "Eres otra persona de la asociación. Sugiere limpiar el parque o montar un pequeño intercambio de ropa, según lo que proponga el estudiante. Acordad un lugar y quién prepara cada cosa.",
    },
    "schule-lernen": {
        "label": "Schule, Studium & Lernen",
        "area": "Bildung, Beruf und Medien",
        "format": "Kurzvortrag mit Rückfragen",
        "description": "Erkläre, wie du lernst und welche Erfahrungen du damit gemacht hast.",
        "opening": "Háblame de cómo estudias para un examen. Describe tu método y cuenta alguna experiencia que te haya ayudado a aprender mejor.",
        "points": (
            "Describe cómo te organizas para estudiar.",
            "Cuenta una experiencia en la que un método te funcionó o no.",
            "Recomienda una estrategia y explica para quién sería útil.",
        ),
        "instructions": "Eres la entrevistadora. Después de la exposición, pregunta por una alternativa concreta, por ejemplo estudiar con alguien o practicar en voz alta.",
    },
    "arbeit-zukunft": {
        "label": "Arbeit & Zukunftspläne",
        "area": "Bildung, Beruf und Medien",
        "format": "Erfahrungen und Meinung austauschen",
        "description": "Erzähle von einer Erfahrung und begründe einen beruflichen Wunsch.",
        "opening": "Me interesa saber qué te gustaría hacer en el futuro. ¿Hay algún trabajo o proyecto que te llame la atención?",
        "points": (
            "Describe un trabajo, unas prácticas o un proyecto que te interese.",
            "Relaciona tu elección con una experiencia anterior.",
            "Explica por qué te atrae y qué harías para prepararte.",
        ),
        "instructions": "Eres la entrevistadora. Pregunta qué dificultad prevé el estudiante o qué le gustaría aprender primero. Acepta experiencias de estudios o de voluntariado como ejemplos.",
    },
    "medien-technologie": {
        "label": "Medien & Technologie",
        "area": "Bildung, Beruf und Medien",
        "format": "Meinung begründen",
        "description": "Diskutiere, wann das Handy beim Lernen hilft oder ablenkt.",
        "opening": "En mi curso hay gente que quiere guardar todos los móviles durante la clase. A mí me parecen útiles si se usan bien. ¿Qué opinas?",
        "points": (
            "Da tu opinión y explica una ventaja y un inconveniente.",
            "Cuenta una experiencia concreta.",
            "Propón una regla que pueda servir a todo el grupo.",
        ),
        "instructions": "Eres una compañera de clase. Reacciona a la opinión con un contraejemplo razonable y pide que concrete en qué momentos aplicaría la regla.",
    },
}


SCENARIOS.update(READING_SCENARIOS)


def public_scenarios():
    fields = ("label", "description", "opening", "area", "format", "points", "reading", "mode")
    return {
        key: {field: scenario[field] for field in fields if field in scenario}
        for key, scenario in SCENARIOS.items()
    }
