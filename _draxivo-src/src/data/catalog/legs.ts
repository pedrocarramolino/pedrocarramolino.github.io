// Piernas (cuádriceps e isquiotibiales), glúteos y gemelos.
import { BW, T, W, x, type CatalogEntry } from './types';

export const QUADS: CatalogEntry[] = [
  x('sentadilla', 'Sentadilla con barra', 'cuadriceps', 'gluteos isquios abdominales', 'barra', 'compuesto', W, 'intermedio', 'squat', 'squat-back', [
    'Coloca la barra sobre los trapecios y saca un paso atrás del soporte.',
    'Pies a la anchura de los hombros y puntas algo hacia fuera.',
    'Baja llevando la cadera atrás y abajo con la espalda neutra.',
    'Sube empujando el suelo con todo el pie.',
  ], { role: 'main', aka: ['squat', 'back squat', 'sentadilla trasera'], alt: ['sentadilla-goblet', 'prensa', 'sentadilla-multipower'] }),
  x('sentadilla-frontal', 'Sentadilla frontal', 'cuadriceps', 'gluteos abdominales', 'barra', 'compuesto', W, 'avanzado', 'squat', 'squat-front', [
    'Apoya la barra sobre la parte delantera de los hombros con los codos altos.',
    'Baja con el tronco erguido.',
    'Sube manteniendo los codos arriba.',
  ], { role: 'main', aka: ['front squat'] }),
  x('sentadilla-goblet', 'Sentadilla goblet', 'cuadriceps', 'gluteos', 'mancuernas', 'compuesto', W, 'principiante', 'squat', 'squat-goblet', [
    'Sujeta una mancuerna o kettlebell junto al pecho.',
    'Baja entre las rodillas con el pecho erguido.',
    'Sube empujando el suelo.',
  ], { role: 'main', aka: ['goblet squat'] }),
  x('sentadilla-hack', 'Sentadilla hack', 'cuadriceps', 'gluteos', 'maquina', 'compuesto', W, 'principiante', 'squat', 'hack-squat', [
    'Apoya la espalda y los hombros en la máquina.',
    'Baja controlando hasta unos 90° de rodilla o más.',
    'Empuja con todo el pie hasta arriba.',
  ], { role: 'main', aka: ['hack squat'] }),
  x('prensa', 'Prensa de piernas', 'cuadriceps', 'gluteos isquios', 'maquina', 'compuesto', W, 'principiante', 'leg-machine', 'leg-press', [
    'Siéntate con la espalda apoyada y los pies a la anchura de la cadera.',
    'Quita los seguros y baja la plataforma hasta unos 90° de rodilla.',
    'Empuja sin bloquear las rodillas de golpe.',
  ], { role: 'main', aka: ['leg press'], mistakes: ['Despegar la zona lumbar del respaldo al bajar.'] }),
  x('extension-cuadriceps', 'Extensión de cuádriceps', 'cuadriceps', '', 'maquina', 'aislamiento', W, 'principiante', 'leg-machine', 'leg-extension', [
    'Ajusta el respaldo para que la rodilla quede alineada con el eje.',
    'Estira las rodillas hasta arriba.',
    'Baja lentamente.',
  ], { aka: ['leg extension'] }),
  x('zancadas', 'Zancadas con mancuernas', 'cuadriceps', 'gluteos isquios', 'mancuernas', 'compuesto', W, 'principiante', 'lunge', 'lunge', [
    'De pie con una mancuerna en cada mano.',
    'Da un paso largo al frente y baja hasta que ambas rodillas formen unos 90°.',
    'Empuja con la pierna delantera para volver.',
  ], { aka: ['lunges', 'estocadas'] }),
  x('bulgara', 'Sentadilla búlgara', 'cuadriceps', 'gluteos', 'mancuernas', 'compuesto', W, 'intermedio', 'lunge', 'bulgarian', [
    'Apoya el empeine del pie trasero en un banco.',
    'Baja la cadera con el tronco estable.',
    'Sube empujando con la pierna delantera.',
  ], { aka: ['bulgarian split squat'] }),
  x('step-up', 'Subidas al cajón', 'cuadriceps', 'gluteos', 'mancuernas', 'compuesto', W, 'principiante', 'lunge', 'step-up', [
    'Apoya un pie entero en el cajón.',
    'Sube empujando con esa pierna hasta quedar erguido.',
    'Baja despacio y repite.',
  ], { aka: ['step up'] }),
  x('sentadilla-peso-corporal', 'Sentadilla sin carga', 'cuadriceps', 'gluteos', 'peso_corporal', 'compuesto', BW, 'principiante', 'squat', 'squat-bw', [
    'Pies a la anchura de los hombros y brazos al frente.',
    'Baja como si fueras a sentarte en una silla.',
    'Sube empujando el suelo.',
  ], { aka: ['air squat', 'bodyweight squat'] }),
  x('sissy-squat', 'Sissy squat', 'cuadriceps', '', 'peso_corporal', 'aislamiento', BW, 'avanzado', 'squat', 'sissy', [
    'Sujétate a un apoyo con una mano.',
    'Inclina el cuerpo hacia atrás mientras doblas las rodillas y subes los talones.',
    'Vuelve a la posición inicial.',
  ], { tips: ['Empieza con poco recorrido: carga mucho la rodilla.'] }),
  x('aduccion-maquina', 'Aducción de cadera en máquina', 'cuadriceps', '', 'maquina', 'aislamiento', W, 'principiante', 'abduct', 'adduction', [
    'Siéntate con las piernas abiertas contra las almohadillas.',
    'Junta las piernas contra la resistencia.',
    'Vuelve despacio.',
  ], { aka: ['adductor machine', 'aductores'] }),
  // Nuevos
  x('sentadilla-goblet-kettlebell', 'Sentadilla goblet con kettlebell', 'cuadriceps', 'gluteos abdominales', 'kettlebell', 'compuesto', W, 'principiante', 'squat', 'squat-goblet', [
    'Sujeta la kettlebell por los lados del asa junto al pecho.',
    'Baja entre las rodillas con el pecho erguido.',
    'Sube empujando el suelo.',
  ], { role: 'main', aka: ['kettlebell goblet squat'] }),
  x('sentadilla-multipower', 'Sentadilla en multipower', 'cuadriceps', 'gluteos', 'maquina', 'compuesto', W, 'principiante', 'squat', 'squat-back', [
    'Coloca la barra guiada sobre los trapecios y los pies algo adelantados.',
    'Desbloquea la barra y baja controlando.',
    'Sube empujando el suelo.',
  ], { role: 'main', aka: ['smith squat'], tips: ['Pon los topes de seguridad un poco por debajo de tu punto más bajo.'] }),
  x('sentadilla-banda', 'Sentadilla con banda elástica', 'cuadriceps', 'gluteos', 'banda', 'compuesto', BW, 'principiante', 'squat', 'squat-band', [
    'Pisa la banda y sujeta los extremos a la altura de los hombros.',
    'Baja en sentadilla con el pecho erguido.',
    'Sube empujando el suelo.',
  ]),
  x('sentadilla-salto', 'Sentadilla con salto', 'cuadriceps', 'gluteos gemelos', 'peso_corporal', 'compuesto', BW, 'intermedio', 'plyo', 'squat-jump', [
    'Baja en sentadilla con los brazos atrás.',
    'Salta lo más alto que puedas llevando los brazos arriba.',
    'Aterriza suave y enlaza la siguiente repetición.',
  ], { aka: ['jump squat'] }),
  x('sentadilla-pared', 'Sentadilla isométrica en pared', 'cuadriceps', 'gluteos', 'peso_corporal', 'aislamiento', T, 'principiante', 'squat', 'wall-sit', [
    'Apoya la espalda en la pared.',
    'Baja hasta que los muslos queden paralelos al suelo.',
    'Aguanta el tiempo indicado.',
  ], { aka: ['wall sit'] }),
  x('zancada-atras', 'Zancada hacia atrás', 'cuadriceps', 'gluteos', 'peso_corporal', 'compuesto', BW, 'principiante', 'lunge', 'lunge-back', [
    'De pie con los pies juntos.',
    'Da un paso atrás y baja hasta que la rodilla trasera casi toque el suelo.',
    'Vuelve empujando con la pierna delantera.',
  ], { aka: ['reverse lunge'], tips: ['Es más suave para la rodilla que la zancada hacia delante.'] }),
  x('zancada-lateral', 'Zancada lateral', 'cuadriceps', 'gluteos', 'peso_corporal', 'compuesto', BW, 'principiante', 'lunge', 'lateral-lunge', [
    'De pie con los pies juntos.',
    'Da un paso amplio hacia el lado y baja doblando esa rodilla.',
    'La otra pierna queda estirada. Empuja para volver.',
  ], { aka: ['side lunge'] }),
  x('zancadas-barra', 'Zancadas con barra', 'cuadriceps', 'gluteos isquios', 'barra', 'compuesto', W, 'intermedio', 'lunge', 'lunge-bar', [
    'Coloca la barra sobre los trapecios.',
    'Da un paso largo al frente y baja.',
    'Empuja para volver y alterna las piernas.',
  ]),
  x('zancadas-caminando', 'Zancadas caminando', 'cuadriceps', 'gluteos isquios', 'mancuernas', 'compuesto', W, 'intermedio', 'lunge', 'lunge', [
    'Con una mancuerna en cada mano, da un paso largo al frente y baja.',
    'Al subir, adelanta la pierna de atrás para dar el siguiente paso.',
    'Avanza alternando las piernas.',
  ], { aka: ['walking lunges'] }),
  x('zancada-kettlebell', 'Zancada con kettlebell', 'cuadriceps', 'gluteos', 'kettlebell', 'compuesto', W, 'principiante', 'lunge', 'lunge-kb', [
    'Sujeta una kettlebell en cada mano o una junto al pecho.',
    'Da un paso al frente y baja hasta que ambas rodillas formen unos 90°.',
    'Vuelve a la posición inicial.',
  ]),
  x('bulgara-peso-corporal', 'Sentadilla búlgara sin carga', 'cuadriceps', 'gluteos', 'peso_corporal', 'compuesto', BW, 'principiante', 'lunge', 'bulgarian-bw', [
    'Apoya el empeine del pie trasero en una silla o un sofá.',
    'Baja la cadera con el tronco estable.',
    'Sube empujando con la pierna delantera.',
  ]),
  x('subidas-escalon', 'Subidas a un escalón', 'cuadriceps', 'gluteos', 'peso_corporal', 'compuesto', BW, 'principiante', 'lunge', 'step-up-bw', [
    'Ponte frente a un escalón o un banco estable.',
    'Sube con una pierna hasta quedar erguido.',
    'Baja despacio y alterna.',
  ]),
  x('prensa-unilateral', 'Prensa a una pierna', 'cuadriceps', 'gluteos', 'maquina', 'compuesto', W, 'intermedio', 'leg-machine', 'leg-press', [
    'Apoya un solo pie en el centro de la plataforma.',
    'Baja controlando hasta unos 90° de rodilla.',
    'Empuja sin bloquear la rodilla.',
  ]),
  x('pistol', 'Sentadilla a una pierna (pistol)', 'cuadriceps', 'gluteos abdominales', 'peso_corporal', 'compuesto', BW, 'avanzado', 'squat', 'pistol', [
    'De pie sobre una pierna con la otra estirada al frente.',
    'Baja todo lo que puedas manteniendo el talón apoyado.',
    'Sube sin apoyar la otra pierna.',
  ], { aka: ['pistol squat'], tips: ['Practica bajando a un banco o sujetándote a un apoyo.'] }),
  x('sentadilla-cajon', 'Sentadilla al cajón', 'cuadriceps', 'gluteos', 'peso_corporal', 'compuesto', BW, 'principiante', 'squat', 'squat-box', [
    'Colócate delante de un cajón o una silla.',
    'Baja hasta rozarlo con los glúteos, sin dejarte caer.',
    'Sube empujando el suelo.',
  ], { aka: ['box squat'] }),
  x('salto-cajon', 'Salto al cajón', 'cuadriceps', 'gluteos gemelos', 'otros', 'compuesto', BW, 'intermedio', 'plyo', 'box-jump', [
    'Colócate frente a un cajón estable.',
    'Baja un poco y salta llevando los brazos arriba.',
    'Aterriza suave sobre el cajón y baja andando.',
  ], { aka: ['box jump'], tips: ['Baja del cajón andando, no saltando hacia atrás.'] }),
];

export const HAMSTRINGS: CatalogEntry[] = [
  x('peso-muerto-rumano', 'Peso muerto rumano', 'isquios', 'gluteos espalda', 'barra', 'compuesto', W, 'intermedio', 'hinge', 'rdl-bar', [
    'De pie con la barra delante de los muslos y las rodillas algo flexionadas.',
    'Lleva la cadera atrás bajando la barra pegada a las piernas.',
    'Baja hasta notar estiramiento detrás de los muslos y vuelve.',
  ], { role: 'main', aka: ['romanian deadlift', 'rdl'] }),
  x('peso-muerto-rumano-mancuernas', 'Peso muerto rumano con mancuernas', 'isquios', 'gluteos', 'mancuernas', 'compuesto', W, 'principiante', 'hinge', 'rdl-db', [
    'Sujeta una mancuerna en cada mano delante de los muslos.',
    'Lleva la cadera atrás con la espalda neutra.',
    'Sube apretando los glúteos.',
  ], { role: 'main' }),
  x('curl-femoral-tumbado', 'Curl femoral tumbado', 'isquios', 'gemelos', 'maquina', 'aislamiento', W, 'principiante', 'leg-curl', 'leg-curl-lying', [
    'Túmbate boca abajo con el rodillo sobre los tobillos.',
    'Lleva los talones hacia los glúteos.',
    'Baja despacio.',
  ], { role: 'sec', aka: ['lying leg curl', 'femoral tumbado'] }),
  x('curl-femoral-sentado', 'Curl femoral sentado', 'isquios', '', 'maquina', 'aislamiento', W, 'principiante', 'leg-curl', 'leg-curl-seated', [
    'Siéntate con los muslos sujetos y el rodillo bajo los tobillos.',
    'Dobla las rodillas llevando los pies hacia abajo y atrás.',
    'Vuelve despacio.',
  ], { role: 'sec', aka: ['seated leg curl'] }),
  x('buenos-dias', 'Buenos días', 'isquios', 'espalda gluteos', 'barra', 'compuesto', W, 'avanzado', 'hinge', 'good-morning', [
    'Coloca la barra sobre los trapecios.',
    'Inclina el tronco llevando la cadera atrás con la espalda neutra.',
    'Vuelve a la posición erguida.',
  ], { aka: ['good morning'] }),
  x('peso-muerto-una-pierna', 'Peso muerto a una pierna', 'isquios', 'gluteos', 'peso_corporal', 'compuesto', BW, 'principiante', 'hinge', 'rdl-single', [
    'De pie sobre una pierna con la rodilla algo flexionada.',
    'Inclina el tronco llevando la otra pierna atrás.',
    'Vuelve a la posición erguida.',
  ], { aka: ['single leg deadlift'] }),
  x('nordic-curl', 'Curl nórdico', 'isquios', '', 'peso_corporal', 'aislamiento', BW, 'avanzado', 'leg-curl', 'nordic', [
    'De rodillas con los tobillos bien sujetos.',
    'Baja el tronco hacia delante lo más lento posible.',
    'Apóyate con las manos y vuelve.',
  ], { gym: true, aka: ['nordic hamstring curl'] }),
  // Nuevos
  x('peso-muerto-rumano-kettlebell', 'Peso muerto rumano con kettlebell', 'isquios', 'gluteos', 'kettlebell', 'compuesto', W, 'principiante', 'hinge', 'rdl-kb', [
    'Sujeta la kettlebell con las dos manos delante de los muslos.',
    'Lleva la cadera atrás con la espalda neutra.',
    'Sube apretando los glúteos.',
  ]),
  x('peso-muerto-piernas-rigidas', 'Peso muerto con piernas rígidas', 'isquios', 'gluteos espalda', 'barra', 'compuesto', W, 'intermedio', 'hinge', 'rdl-bar', [
    'Rodillas casi estiradas y barra delante de los muslos.',
    'Inclina el tronco desde la cadera hasta notar estiramiento.',
    'Vuelve a la posición erguida.',
  ], { aka: ['stiff leg deadlift'] }),
  x('peso-muerto-mancuernas', 'Peso muerto con mancuernas', 'isquios', 'gluteos espalda cuadriceps', 'mancuernas', 'compuesto', W, 'principiante', 'hinge', 'deadlift-db', [
    'Mancuernas a los lados de los pies.',
    'Baja la cadera con el pecho arriba y agárralas.',
    'Empuja el suelo hasta quedar erguido.',
  ], { role: 'main', aka: ['dumbbell deadlift'] }),
  x('peso-muerto-kettlebell', 'Peso muerto con kettlebell', 'isquios', 'gluteos espalda', 'kettlebell', 'compuesto', W, 'principiante', 'hinge', 'deadlift-kb', [
    'Kettlebell entre los pies.',
    'Baja la cadera y agárrala con las dos manos.',
    'Empuja el suelo hasta quedar erguido.',
  ], { aka: ['kettlebell deadlift'] }),
  x('peso-muerto-una-pierna-mancuerna', 'Peso muerto a una pierna con mancuerna', 'isquios', 'gluteos', 'mancuernas', 'compuesto', W, 'intermedio', 'hinge', 'rdl-single-db', [
    'De pie sobre una pierna con una mancuerna en la mano contraria.',
    'Inclina el tronco llevando la otra pierna atrás.',
    'Vuelve a la posición erguida.',
  ]),
  x('curl-femoral-deslizante', 'Curl femoral con deslizadores', 'isquios', 'gluteos', 'peso_corporal', 'aislamiento', BW, 'intermedio', 'leg-curl', 'ham-slide', [
    'Túmbate boca arriba con los talones sobre una toalla o deslizadores.',
    'Eleva la cadera.',
    'Lleva los talones hacia los glúteos sin bajar la cadera y vuelve.',
  ], { aka: ['slider leg curl'], tips: ['En casa, una toalla en suelo liso sirve de deslizador.'] }),
  x('buenos-dias-banda', 'Buenos días con banda', 'isquios', 'gluteos espalda', 'banda', 'compuesto', BW, 'principiante', 'hinge', 'good-morning', [
    'Pisa la banda y pásala por detrás del cuello.',
    'Inclina el tronco llevando la cadera atrás.',
    'Vuelve a la posición erguida.',
  ]),
];

export const GLUTES: CatalogEntry[] = [
  x('hip-thrust', 'Hip thrust con barra', 'gluteos', 'isquios', 'barra', 'compuesto', W, 'principiante', 'thrust', 'hip-thrust', [
    'Apoya la parte alta de la espalda en un banco con la barra sobre la cadera.',
    'Pies apoyados a la anchura de la cadera.',
    'Eleva la cadera hasta alinear tronco y muslos y baja controlado.',
  ], { role: 'main', aka: ['hip thrust', 'empuje de cadera'], tips: ['Usa una almohadilla en la barra para no hacerte daño en la cadera.'] }),
  x('puente-gluteo', 'Puente de glúteo', 'gluteos', 'isquios', 'peso_corporal', 'aislamiento', BW, 'principiante', 'thrust', 'glute-bridge', [
    'Túmbate boca arriba con las rodillas dobladas.',
    'Eleva la cadera apretando los glúteos.',
    'Baja despacio.',
  ], { role: 'sec', aka: ['glute bridge'] }),
  x('patada-gluteo-polea', 'Patada de glúteo en polea', 'gluteos', '', 'polea', 'aislamiento', W, 'principiante', 'thrust', 'cable-kickback', [
    'Ponte una tobillera en la polea baja.',
    'Lleva la pierna hacia atrás extendiendo la cadera.',
    'Vuelve despacio sin arquear la espalda.',
  ], { aka: ['cable kickback'] }),
  x('abduccion-maquina', 'Abducción de cadera en máquina', 'gluteos', '', 'maquina', 'aislamiento', W, 'principiante', 'abduct', 'abduction', [
    'Siéntate con las piernas juntas contra las almohadillas.',
    'Separa las piernas contra la resistencia.',
    'Vuelve despacio.',
  ], { aka: ['abductor machine', 'abductores'] }),
  x('peso-muerto-sumo', 'Peso muerto sumo', 'gluteos', 'cuadriceps espalda isquios', 'barra', 'compuesto', W, 'avanzado', 'hinge', 'deadlift-sumo', [
    'Pies muy abiertos y puntas hacia fuera.',
    'Agarra la barra entre las piernas con la espalda neutra.',
    'Extiende cadera y rodillas a la vez.',
  ], { role: 'main', aka: ['sumo deadlift'] }),
  x('monster-walk', 'Paso lateral con banda', 'gluteos', '', 'banda', 'aislamiento', BW, 'principiante', 'abduct', 'monster-walk', [
    'Coloca la banda en las rodillas o los tobillos.',
    'Baja un poco en semisentadilla.',
    'Camina de lado manteniendo la tensión.',
  ], { aka: ['monster walk', 'lateral band walk'] }),
  // Nuevos
  x('hip-thrust-mancuerna', 'Hip thrust con mancuerna', 'gluteos', 'isquios', 'mancuernas', 'compuesto', W, 'principiante', 'thrust', 'hip-thrust-db', [
    'Apoya la parte alta de la espalda en un banco o un sofá.',
    'Coloca una mancuerna sobre la cadera y sujétala.',
    'Eleva la cadera hasta alinear tronco y muslos.',
  ], { role: 'main' }),
  x('hip-thrust-maquina', 'Hip thrust en máquina', 'gluteos', 'isquios', 'maquina', 'compuesto', W, 'principiante', 'thrust', 'hip-thrust', [
    'Ajusta la almohadilla sobre la cadera.',
    'Empuja con los talones elevando la cadera.',
    'Baja controlado.',
  ], { role: 'main' }),
  x('hip-thrust-una-pierna', 'Hip thrust a una pierna', 'gluteos', 'isquios', 'peso_corporal', 'compuesto', BW, 'intermedio', 'thrust', 'hip-thrust-bw', [
    'Espalda alta apoyada en un banco o un sofá, una pierna en el aire.',
    'Empuja con el talón de apoyo elevando la cadera.',
    'Baja despacio y cambia de pierna.',
  ], { aka: ['single leg hip thrust'] }),
  x('puente-gluteo-banda', 'Puente de glúteo con banda', 'gluteos', 'isquios', 'banda', 'aislamiento', BW, 'principiante', 'thrust', 'glute-bridge', [
    'Coloca la banda justo por encima de las rodillas.',
    'Eleva la cadera empujando las rodillas hacia fuera.',
    'Baja despacio.',
  ]),
  x('puente-gluteo-una-pierna', 'Puente de glúteo a una pierna', 'gluteos', 'isquios', 'peso_corporal', 'aislamiento', BW, 'principiante', 'thrust', 'glute-bridge', [
    'Túmbate boca arriba con una pierna doblada y la otra estirada.',
    'Eleva la cadera empujando con el talón de apoyo.',
    'Baja y cambia de pierna.',
  ]),
  x('patada-gluteo-cuadrupedia', 'Patada de glúteo en cuadrupedia', 'gluteos', 'isquios', 'peso_corporal', 'aislamiento', BW, 'principiante', 'thrust', 'donkey-kick', [
    'Ponte a cuatro patas con las manos bajo los hombros.',
    'Eleva una pierna con la rodilla doblada hasta que el muslo quede horizontal.',
    'Baja despacio y repite.',
  ], { aka: ['donkey kick', 'patada de burro'] }),
  x('abduccion-tumbado', 'Abducción de cadera tumbado de lado', 'gluteos', '', 'peso_corporal', 'aislamiento', BW, 'principiante', 'abduct', 'side-lying', [
    'Túmbate de lado con las piernas estiradas.',
    'Eleva la pierna de arriba sin girar la cadera.',
    'Baja despacio.',
  ], { aka: ['side lying leg raise'] }),
  x('almeja-banda', 'Almeja con banda (clamshell)', 'gluteos', '', 'banda', 'aislamiento', BW, 'principiante', 'abduct', 'side-lying', [
    'Túmbate de lado con las rodillas dobladas y la banda sobre ellas.',
    'Separa la rodilla de arriba manteniendo los pies juntos.',
    'Vuelve despacio.',
  ], { aka: ['clamshell'] }),
  x('sentadilla-sumo-kettlebell', 'Sentadilla sumo con kettlebell', 'gluteos', 'cuadriceps', 'kettlebell', 'compuesto', W, 'principiante', 'squat', 'sumo-kb', [
    'Pies muy abiertos y puntas hacia fuera, la kettlebell entre las piernas.',
    'Baja con el pecho erguido.',
    'Sube apretando los glúteos.',
  ], { role: 'main', aka: ['sumo squat'] }),
  x('patada-gluteo-maquina', 'Patada de glúteo en máquina', 'gluteos', 'isquios', 'maquina', 'aislamiento', W, 'principiante', 'thrust', 'cable-kickback', [
    'Apoya el pecho y una pierna en la máquina.',
    'Empuja la plataforma hacia atrás extendiendo la cadera.',
    'Vuelve despacio.',
  ]),
];

export const CALVES: CatalogEntry[] = [
  x('gemelo-de-pie', 'Elevación de gemelos de pie', 'gemelos', '', 'maquina', 'aislamiento', W, 'principiante', 'calf', 'calf-machine', [
    'Coloca los hombros bajo las almohadillas y las puntas en el escalón.',
    'Sube los talones al máximo.',
    'Baja hasta notar estiramiento.',
  ], { role: 'sec', aka: ['standing calf raise'] }),
  x('gemelo-sentado', 'Elevación de gemelos sentado', 'gemelos', '', 'maquina', 'aislamiento', W, 'principiante', 'calf', 'calf-seated', [
    'Siéntate con las rodillas bajo la almohadilla.',
    'Eleva los talones con control.',
    'Baja hasta notar estiramiento.',
  ], { role: 'sec', aka: ['seated calf raise'] }),
  x('gemelo-prensa', 'Gemelos en prensa', 'gemelos', '', 'maquina', 'aislamiento', W, 'principiante', 'calf', 'leg-press-calf', [
    'En la prensa, apoya sólo la punta de los pies en la plataforma.',
    'Empuja con los tobillos sin doblar las rodillas.',
    'Vuelve despacio.',
  ], { role: 'sec' }),
  x('gemelo-peso-corporal', 'Elevación de gemelos a una pierna', 'gemelos', '', 'peso_corporal', 'aislamiento', BW, 'principiante', 'calf', 'calf-single', [
    'De pie sobre un escalón con una pierna, apóyate con la mano.',
    'Sube sobre la punta del pie.',
    'Baja el talón por debajo del escalón.',
  ], { role: 'sec' }),
  // Nuevos
  x('gemelo-mancuernas', 'Elevación de gemelos con mancuernas', 'gemelos', '', 'mancuernas', 'aislamiento', W, 'principiante', 'calf', 'calf-single', [
    'De pie con una mancuerna en cada mano y las puntas sobre un escalón.',
    'Sube los talones al máximo.',
    'Baja hasta notar estiramiento.',
  ], { role: 'sec' }),
  x('gemelo-multipower', 'Elevación de gemelos en multipower', 'gemelos', '', 'maquina', 'aislamiento', W, 'principiante', 'calf', 'calf-machine', [
    'Barra guiada sobre los trapecios y puntas sobre un disco o escalón.',
    'Sube los talones al máximo.',
    'Baja hasta notar estiramiento.',
  ], { role: 'sec' }),
  x('gemelo-escalon', 'Elevación de gemelos en escalón', 'gemelos', '', 'peso_corporal', 'aislamiento', BW, 'principiante', 'calf', 'calf-single', [
    'De pie con las dos puntas sobre un escalón.',
    'Sube los talones al máximo.',
    'Baja despacio por debajo del escalón.',
  ], { role: 'sec' }),
  x('saltos-tobillo', 'Saltos de tobillo', 'gemelos', '', 'peso_corporal', 'aislamiento', BW, 'intermedio', 'plyo', 'jump-rope', [
    'De pie, rodillas casi estiradas.',
    'Salta con pequeños rebotes usando sólo los tobillos.',
    'Mantén un ritmo rápido y regular.',
  ], { aka: ['pogo jumps'] }),
];
