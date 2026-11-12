// Pecho, espalda y hombros.
import { BW, W, x, type CatalogEntry } from './types';

export const CHEST: CatalogEntry[] = [
  x('press-banca', 'Press de banca con barra', 'pecho', 'triceps hombros', 'barra', 'compuesto', W, 'intermedio', 'press-h', 'bench-bar', [
    'Túmbate con los ojos bajo la barra y los pies firmes en el suelo.',
    'Agarra la barra algo más abierta que los hombros y junta las escápulas.',
    'Baja la barra controlada hasta la mitad del pecho.',
    'Empuja hasta estirar los codos sin despegar la cadera.',
  ], { role: 'main', aka: ['bench press', 'press banca', 'banca'], alt: ['press-banca-mancuernas', 'press-pecho-maquina', 'flexiones'] }),
  x('press-inclinado-barra', 'Press inclinado con barra', 'pecho', 'hombros triceps', 'barra', 'compuesto', W, 'intermedio', 'press-h', 'incline-bar', [
    'Coloca el banco a 30–45° y túmbate con la espalda apoyada.',
    'Baja la barra hacia la parte alta del pecho.',
    'Empuja en línea recta hasta estirar los brazos.',
  ], { role: 'main', aka: ['incline bench press'] }),
  x('press-declinado-barra', 'Press declinado con barra', 'pecho', 'triceps', 'barra', 'compuesto', W, 'intermedio', 'press-h', 'decline-bar', [
    'Túmbate en el banco declinado con las piernas bien sujetas.',
    'Baja la barra a la parte baja del pecho.',
    'Empuja hasta estirar los codos.',
  ], { tips: ['Pide ayuda para coger y dejar la barra: la posición dificulta reaccionar.'] }),
  x('press-banca-mancuernas', 'Press de banca con mancuernas', 'pecho', 'triceps hombros', 'mancuernas', 'compuesto', W, 'principiante', 'press-h', 'bench-db', [
    'Siéntate con las mancuernas sobre los muslos y túmbate llevándolas al pecho.',
    'Baja las mancuernas a los lados del pecho hasta notar estiramiento.',
    'Empuja hacia arriba juntándolas ligeramente al final.',
  ], { role: 'main', aka: ['dumbbell bench press'] }),
  x('press-inclinado-mancuernas', 'Press inclinado con mancuernas', 'pecho', 'hombros triceps', 'mancuernas', 'compuesto', W, 'principiante', 'press-h', 'incline-db', [
    'Banco a 30–45°, una mancuerna en cada mano a la altura del pecho.',
    'Empuja hacia arriba y ligeramente hacia dentro.',
    'Baja controlando hasta notar estiramiento en el pecho.',
  ], { role: 'main' }),
  x('aperturas-mancuernas', 'Aperturas con mancuernas', 'pecho', 'hombros', 'mancuernas', 'aislamiento', W, 'principiante', 'fly', 'fly-db', [
    'Túmbate en el banco con las mancuernas arriba y los codos algo flexionados.',
    'Abre los brazos en arco hasta notar estiramiento.',
    'Vuelve por el mismo camino sin chocar las mancuernas.',
  ], { aka: ['dumbbell fly', 'aperturas'] }),
  x('cruce-poleas', 'Cruce de poleas', 'pecho', 'hombros', 'polea', 'aislamiento', W, 'principiante', 'fly', 'cable-cross', [
    'De pie entre dos poleas altas, da un paso adelante con un agarre en cada mano.',
    'Junta las manos delante del cuerpo en arco con los codos fijos.',
    'Vuelve despacio hasta notar estiramiento en el pecho.',
  ], { aka: ['cable crossover', 'crossover'] }),
  x('press-pecho-maquina', 'Press de pecho en máquina', 'pecho', 'triceps hombros', 'maquina', 'compuesto', W, 'principiante', 'press-h', 'chest-press-machine', [
    'Ajusta el asiento para que las asas queden a la altura del pecho.',
    'Empuja hacia delante hasta casi estirar los brazos.',
    'Vuelve controlando sin soltar la tensión.',
  ], { aka: ['chest press'] }),
  x('pec-deck', 'Contractor de pecho (pec deck)', 'pecho', 'hombros', 'maquina', 'aislamiento', W, 'principiante', 'fly', 'pec-deck', [
    'Siéntate con la espalda apoyada y los brazos en las almohadillas o asas.',
    'Junta los brazos delante del pecho.',
    'Vuelve despacio controlando el estiramiento.',
  ], { aka: ['peck deck', 'mariposa'] }),
  x('flexiones', 'Flexiones', 'pecho', 'triceps hombros abdominales', 'peso_corporal', 'compuesto', BW, 'principiante', 'pushup', 'pushup', [
    'Apoya las manos algo más abiertas que los hombros y estira el cuerpo.',
    'Baja el pecho cerca del suelo con los codos a unos 45°.',
    'Empuja el suelo hasta estirar los brazos.',
  ], { aka: ['push up', 'lagartijas'], alt: ['flexiones-inclinadas', 'flexiones-rodillas', 'press-banca-mancuernas'] }),
  x('fondos-pecho', 'Fondos en paralelas (pecho)', 'pecho', 'triceps hombros', 'peso_corporal', 'compuesto', BW, 'intermedio', 'dip', 'dip', [
    'Sujétate en las paralelas con los brazos estirados.',
    'Inclina el tronco hacia delante y baja doblando los codos.',
    'Empuja hasta estirar los brazos.',
  ], { gym: true, aka: ['dips'] }),
  x('fondos-lastrados', 'Fondos lastrados', 'pecho', 'triceps hombros', 'peso_corporal', 'compuesto', 'weighted_bodyweight', 'avanzado', 'dip', 'dip-weighted', [
    'Colócate un cinturón con lastre o una mancuerna entre las piernas.',
    'Haz el fondo igual que sin carga, con el tronco algo inclinado.',
    'Registra sólo el peso añadido.',
  ], { gym: true, role: 'main' }),
  x('fondos-asistidos', 'Fondos asistidos en máquina', 'pecho', 'triceps', 'maquina', 'compuesto', 'assisted_bodyweight', 'principiante', 'dip', 'dip-assisted', [
    'Elige la asistencia y apoya las rodillas en la plataforma.',
    'Baja doblando los codos con el tronco algo inclinado.',
    'Empuja hasta estirar los brazos. Registra la asistencia: menos asistencia es más difícil.',
  ], { gym: true }),
  x('press-banda', 'Press de pecho con banda', 'pecho', 'triceps', 'banda', 'compuesto', BW, 'principiante', 'press-h', 'band-press', [
    'Ancla la banda detrás de ti a la altura del pecho.',
    'Empuja hacia delante hasta estirar los brazos.',
    'Vuelve despacio sin dejar que la banda tire de ti.',
  ], { tips: ['Revisa que la banda no tenga cortes y que el anclaje sea firme.'] }),
  // Nuevos
  x('press-banca-multipower', 'Press de banca en multipower', 'pecho', 'triceps hombros', 'maquina', 'compuesto', W, 'principiante', 'press-h', 'bench-bar', [
    'Coloca el banco para que la barra baje a la mitad del pecho.',
    'Desbloquea la barra girando las muñecas.',
    'Baja controlado y empuja hasta estirar los brazos.',
  ], { aka: ['smith', 'press en smith'], tips: ['Pon los topes de seguridad a la altura del pecho.'] }),
  x('press-inclinado-maquina', 'Press inclinado en máquina', 'pecho', 'hombros triceps', 'maquina', 'compuesto', W, 'principiante', 'press-h', 'chest-press-machine', [
    'Ajusta el asiento para que las asas queden a la altura de la parte alta del pecho.',
    'Empuja hacia delante y hacia arriba.',
    'Vuelve despacio hasta notar estiramiento.',
  ]),
  x('aperturas-inclinadas', 'Aperturas inclinadas con mancuernas', 'pecho', 'hombros', 'mancuernas', 'aislamiento', W, 'principiante', 'fly', 'fly-db', [
    'Banco a 30°, mancuernas arriba con los codos algo flexionados.',
    'Abre los brazos en arco hasta notar estiramiento.',
    'Junta las mancuernas arriba sin chocarlas.',
  ]),
  x('cruce-poleas-bajo', 'Cruce de poleas de abajo arriba', 'pecho', 'hombros', 'polea', 'aislamiento', W, 'principiante', 'fly', 'cable-cross', [
    'Poleas en la posición baja, un agarre en cada mano.',
    'Lleva las manos en arco hacia arriba y hacia dentro, hasta la altura del pecho.',
    'Baja controlando.',
  ], { aka: ['low to high cable fly'] }),
  x('press-suelo-mancuernas', 'Press en el suelo con mancuernas', 'pecho', 'triceps hombros', 'mancuernas', 'compuesto', W, 'principiante', 'press-h', 'bench-db', [
    'Túmbate boca arriba con las rodillas dobladas y una mancuerna en cada mano.',
    'Baja hasta que los codos toquen suavemente el suelo.',
    'Empuja hasta estirar los brazos.',
  ], { aka: ['floor press'], home: true }),
  x('press-suelo-kettlebell', 'Press en el suelo con kettlebell', 'pecho', 'triceps hombros', 'kettlebell', 'compuesto', W, 'principiante', 'press-h', 'bench-kb', [
    'Túmbate boca arriba con una kettlebell en cada mano, el asa en la palma.',
    'Baja hasta que los codos toquen el suelo.',
    'Empuja hacia arriba manteniendo la muñeca recta.',
  ], { tips: ['Mantén la muñeca recta: la bola descansa sobre el antebrazo.'] }),
  x('flexiones-inclinadas', 'Flexiones inclinadas', 'pecho', 'triceps hombros', 'peso_corporal', 'compuesto', BW, 'principiante', 'pushup', 'pushup-incline', [
    'Apoya las manos en un banco, una mesa firme o una encimera.',
    'Estira el cuerpo en línea con los pies atrás.',
    'Baja el pecho hacia el apoyo y empuja.',
  ], { aka: ['incline push up'], tips: ['Cuanto más alto el apoyo, más fácil. Baja la altura para progresar.'] }),
  x('flexiones-rodillas', 'Flexiones de rodillas', 'pecho', 'triceps hombros', 'peso_corporal', 'compuesto', BW, 'principiante', 'pushup', 'pushup-knee', [
    'Apoya las rodillas en una esterilla y las manos bajo los hombros.',
    'Mantén la línea de las rodillas a la cabeza.',
    'Baja el pecho y empuja el suelo.',
  ], { aka: ['knee push up'] }),
  x('flexiones-declinadas', 'Flexiones declinadas', 'pecho', 'hombros triceps', 'peso_corporal', 'compuesto', BW, 'intermedio', 'pushup', 'pushup-decline', [
    'Apoya los pies en un banco o una silla y las manos en el suelo.',
    'Mantén el cuerpo recto.',
    'Baja el pecho hacia el suelo y empuja.',
  ], { aka: ['decline push up'] }),
  x('aperturas-banda', 'Aperturas con banda elástica', 'pecho', 'hombros', 'banda', 'aislamiento', BW, 'principiante', 'fly', 'band-press', [
    'Ancla la banda detrás de ti a la altura del pecho y sujeta un extremo en cada mano.',
    'Junta las manos delante del pecho en arco con los codos algo flexionados.',
    'Vuelve despacio.',
  ]),
  x('pullover-mancuerna', 'Pullover con mancuerna', 'pecho', 'espalda triceps', 'mancuernas', 'aislamiento', W, 'intermedio', 'pullover', 'pullover-db', [
    'Túmbate en el banco sujetando una mancuerna con las dos manos sobre el pecho.',
    'Lleva la mancuerna en arco por detrás de la cabeza con los codos algo flexionados.',
    'Vuelve a la posición inicial sobre el pecho.',
  ], { aka: ['pullover'] }),
];

export const BACK: CatalogEntry[] = [
  x('peso-muerto', 'Peso muerto', 'espalda', 'isquios gluteos antebrazos', 'barra', 'compuesto', W, 'intermedio', 'hinge', 'deadlift', [
    'Coloca la barra sobre el centro del pie y agárrala con las manos fuera de las piernas.',
    'Baja la cadera, pecho arriba y espalda neutra.',
    'Empuja el suelo con las piernas y extiende la cadera hasta quedar erguido.',
    'Baja la barra pegada a las piernas.',
  ], { role: 'main', aka: ['deadlift', 'peso muerto convencional'], alt: ['peso-muerto-mancuernas', 'peso-muerto-trap-bar', 'peso-muerto-kettlebell'] }),
  x('dominadas', 'Dominadas', 'espalda', 'biceps antebrazos', 'peso_corporal', 'compuesto', BW, 'intermedio', 'pull-v', 'pullup', [
    'Cuélgate de la barra con agarre prono algo más ancho que los hombros.',
    'Baja los hombros y tira hasta pasar la barbilla por encima de la barra.',
    'Baja controlado hasta estirar los brazos.',
  ], { role: 'main', gym: true, aka: ['pull up', 'pull-ups'], alt: ['dominadas-asistidas', 'jalon-pecho', 'remo-invertido'] }),
  x('dominadas-lastradas', 'Dominadas lastradas', 'espalda', 'biceps', 'peso_corporal', 'compuesto', 'weighted_bodyweight', 'avanzado', 'pull-v', 'pullup-weighted', [
    'Colócate el cinturón de lastre o una mancuerna entre los pies.',
    'Haz la dominada completa sin balanceo.',
    'Registra sólo el peso añadido.',
  ], { role: 'main', gym: true }),
  x('dominadas-asistidas', 'Dominadas asistidas', 'espalda', 'biceps', 'maquina', 'compuesto', 'assisted_bodyweight', 'principiante', 'pull-v', 'pullup-assisted', [
    'En la máquina o con una banda, elige la asistencia.',
    'Tira hasta pasar la barbilla por encima de la barra.',
    'Baja despacio. Registra la asistencia: menos es más difícil.',
  ], { role: 'main', gym: true }),
  x('chin-ups', 'Dominadas supinas', 'espalda', 'biceps', 'peso_corporal', 'compuesto', BW, 'intermedio', 'pull-v', 'pullup', [
    'Agarra la barra con las palmas hacia ti, a la anchura de los hombros.',
    'Tira llevando el pecho hacia la barra.',
    'Baja hasta estirar los brazos.',
  ], { role: 'main', gym: true, aka: ['chin up'] }),
  x('jalon-pecho', 'Jalón al pecho', 'espalda', 'biceps', 'polea', 'compuesto', W, 'principiante', 'pull-v', 'lat-pulldown', [
    'Siéntate con los muslos sujetos bajo los rodillos.',
    'Agarra la barra algo más abierta que los hombros.',
    'Lleva la barra a la parte alta del pecho bajando los codos.',
    'Sube despacio hasta estirar los brazos.',
  ], { role: 'main', aka: ['lat pulldown', 'polea al pecho'] }),
  x('jalon-agarre-cerrado', 'Jalón con agarre cerrado', 'espalda', 'biceps', 'polea', 'compuesto', W, 'principiante', 'pull-v', 'lat-pulldown', [
    'Usa un agarre estrecho neutro (triángulo).',
    'Tira hacia el pecho con el tronco estable.',
    'Vuelve hasta estirar los brazos.',
  ]),
  x('remo-barra', 'Remo con barra', 'espalda', 'biceps isquios', 'barra', 'compuesto', W, 'intermedio', 'row', 'row-bar', [
    'Inclina el tronco unos 45° con las rodillas algo flexionadas.',
    'Lleva la barra hacia el abdomen juntando las escápulas.',
    'Baja controlado sin perder la postura.',
  ], { role: 'main', aka: ['barbell row'] }),
  x('remo-mancuerna', 'Remo con mancuerna a una mano', 'espalda', 'biceps', 'mancuernas', 'compuesto', W, 'principiante', 'row', 'row-db-one', [
    'Apoya rodilla y mano del mismo lado en el banco.',
    'Tira de la mancuerna hacia la cadera.',
    'Baja hasta estirar el brazo.',
  ], { role: 'main', aka: ['one arm row'] }),
  x('remo-polea-baja', 'Remo en polea baja', 'espalda', 'biceps', 'polea', 'compuesto', W, 'principiante', 'row', 'row-cable', [
    'Siéntate con los pies apoyados y la espalda erguida.',
    'Tira del agarre hacia el abdomen juntando las escápulas.',
    'Vuelve estirando los brazos sin inclinarte hacia delante.',
  ], { aka: ['seated cable row', 'remo gironda'] }),
  x('remo-maquina', 'Remo en máquina', 'espalda', 'biceps', 'maquina', 'compuesto', W, 'principiante', 'row', 'row-machine', [
    'Ajusta el asiento y apoya el pecho en el respaldo.',
    'Tira de las asas hasta que los codos pasen el tronco.',
    'Vuelve despacio.',
  ]),
  x('remo-t', 'Remo en T', 'espalda', 'biceps', 'barra', 'compuesto', W, 'intermedio', 'row', 'row-landmine', [
    'Con la barra anclada, colócate sobre ella con el tronco inclinado.',
    'Rema llevando el agarre hacia el pecho.',
    'Baja controlado.',
  ], { aka: ['t-bar row'] }),
  x('pullover-polea', 'Pullover en polea alta', 'espalda', 'triceps', 'polea', 'aislamiento', W, 'principiante', 'pullover', 'pullover-cable', [
    'De pie frente a la polea alta con los brazos casi estirados.',
    'Lleva la barra en arco desde arriba hasta los muslos.',
    'Vuelve despacio arriba.',
  ], { aka: ['straight arm pulldown', 'jalón con brazos rectos'] }),
  x('hiperextensiones', 'Hiperextensiones', 'espalda', 'gluteos isquios', 'peso_corporal', 'aislamiento', BW, 'principiante', 'back-ext', 'back-extension', [
    'Ajusta el banco romano para que la cadera quede libre.',
    'Baja el tronco flexionando la cadera.',
    'Sube hasta alinear el tronco con las piernas.',
  ], { gym: true, aka: ['back extension'] }),
  x('encogimientos', 'Encogimientos con mancuernas', 'espalda', 'antebrazos', 'mancuernas', 'aislamiento', W, 'principiante', 'shrug', 'shrug', [
    'De pie con una mancuerna en cada mano y los brazos estirados.',
    'Eleva los hombros hacia las orejas.',
    'Baja lentamente.',
  ], { aka: ['shrugs', 'trapecio'] }),
  x('remo-banda', 'Remo con banda elástica', 'espalda', 'biceps', 'banda', 'compuesto', BW, 'principiante', 'row', 'row-band', [
    'Ancla la banda delante a la altura del abdomen.',
    'Tira de la banda hacia el abdomen juntando las escápulas.',
    'Vuelve despacio.',
  ]),
  // Nuevos
  x('remo-invertido', 'Remo invertido', 'espalda', 'biceps abdominales', 'peso_corporal', 'compuesto', BW, 'principiante', 'row', 'inverted-row', [
    'Túmbate bajo una barra baja o una mesa firme y agárrala.',
    'Cuerpo recto con los talones en el suelo.',
    'Tira del pecho hacia la barra y baja controlado.',
  ], { aka: ['inverted row', 'australian pull up', 'remo australiano'], tips: ['Si haces el ejercicio en casa, comprueba que la mesa soporta tu peso.'] }),
  x('remo-kettlebell', 'Remo con kettlebell', 'espalda', 'biceps', 'kettlebell', 'compuesto', W, 'principiante', 'row', 'row-kb', [
    'Inclina el tronco con la espalda neutra y la kettlebell colgando.',
    'Tira de ella hacia la cadera.',
    'Baja hasta estirar el brazo.',
  ]),
  x('remo-pendlay', 'Remo Pendlay', 'espalda', 'biceps isquios', 'barra', 'compuesto', W, 'avanzado', 'row', 'row-bar', [
    'Tronco casi paralelo al suelo y barra apoyada en el suelo.',
    'Tira de forma explosiva hacia el abdomen.',
    'Devuelve la barra al suelo en cada repetición.',
  ], { aka: ['pendlay row'] }),
  x('remo-pecho-apoyado', 'Remo con pecho apoyado', 'espalda', 'biceps hombros', 'mancuernas', 'compuesto', W, 'principiante', 'row', 'row-machine', [
    'Túmbate boca abajo en un banco inclinado con una mancuerna en cada mano.',
    'Tira de las mancuernas hacia la cadera.',
    'Baja hasta estirar los brazos.',
  ], { aka: ['chest supported row', 'remo seal'] }),
  x('jalon-banda', 'Jalón con banda elástica', 'espalda', 'biceps', 'banda', 'compuesto', BW, 'principiante', 'pull-v', 'pulldown-band', [
    'Ancla la banda en lo alto de una puerta o barra.',
    'Con los brazos arriba, tira de la banda bajando los codos hacia los costados.',
    'Vuelve despacio arriba.',
  ], { aka: ['band pulldown'] }),
  x('superman', 'Superman', 'espalda', 'gluteos hombros', 'peso_corporal', 'aislamiento', BW, 'principiante', 'back-ext', 'superman', [
    'Túmbate boca abajo con los brazos estirados al frente.',
    'Eleva a la vez brazos, pecho y piernas unos centímetros.',
    'Mantén un segundo y baja despacio.',
  ], { tips: ['Mira al suelo para mantener el cuello alineado.'] }),
  x('rack-pull', 'Peso muerto desde bloques', 'espalda', 'gluteos isquios antebrazos', 'barra', 'compuesto', W, 'intermedio', 'hinge', 'deadlift', [
    'Coloca la barra en los soportes a la altura de las rodillas.',
    'Agárrala con la espalda neutra.',
    'Extiende la cadera hasta quedar erguido y baja controlado.',
  ], { aka: ['rack pull'] }),
  x('dominadas-neutras', 'Dominadas con agarre neutro', 'espalda', 'biceps antebrazos', 'peso_corporal', 'compuesto', BW, 'intermedio', 'pull-v', 'pullup', [
    'Agarra las asas paralelas con las palmas enfrentadas.',
    'Tira hasta que la barbilla supere las manos.',
    'Baja controlado.',
  ], { gym: true, role: 'main', aka: ['neutral grip pull up'] }),
  x('remo-renegado', 'Remo renegado', 'espalda', 'abdominales hombros', 'mancuernas', 'compuesto', W, 'intermedio', 'row', 'renegade-row', [
    'En posición de plancha con las manos sobre dos mancuernas.',
    'Rema una mancuerna hacia la cadera sin girar el tronco.',
    'Apóyala y repite con el otro brazo.',
  ], { aka: ['renegade row'], tips: ['Separa los pies para tener más estabilidad.'] }),
  x('encogimientos-barra', 'Encogimientos con barra', 'espalda', 'antebrazos', 'barra', 'aislamiento', W, 'principiante', 'shrug', 'shrug', [
    'Sujeta la barra delante de los muslos con los brazos estirados.',
    'Eleva los hombros hacia las orejas.',
    'Haz una pausa y baja despacio.',
  ]),
  x('jalon-unilateral', 'Jalón a una mano en polea', 'espalda', 'biceps', 'polea', 'compuesto', W, 'principiante', 'pull-v', 'lat-pulldown', [
    'Siéntate o arrodíllate frente a la polea alta con un agarre en una mano.',
    'Tira llevando el codo hacia la cadera.',
    'Vuelve hasta estirar el brazo.',
  ]),
  x('peso-muerto-trap-bar', 'Peso muerto con barra hexagonal', 'espalda', 'cuadriceps gluteos isquios', 'barra', 'compuesto', W, 'principiante', 'hinge', 'deadlift', [
    'Colócate dentro de la barra hexagonal y agarra las asas.',
    'Baja la cadera con el pecho arriba.',
    'Empuja el suelo hasta quedar erguido y baja controlado.',
  ], { role: 'main', aka: ['trap bar deadlift', 'hex bar'] }),
];

export const SHOULDERS: CatalogEntry[] = [
  x('face-pull', 'Face pull', 'hombros', 'espalda', 'polea', 'aislamiento', W, 'principiante', 'rear', 'face-pull', [
    'Coloca la polea a la altura de la cara con una cuerda.',
    'Tira hacia la cara separando las manos hacia las orejas.',
    'Vuelve despacio.',
  ]),
  x('press-militar', 'Press militar con barra', 'hombros', 'triceps', 'barra', 'compuesto', W, 'intermedio', 'press-v', 'ohp-bar', [
    'De pie, barra sobre la parte alta del pecho y agarre algo más ancho que los hombros.',
    'Aprieta glúteos y abdomen.',
    'Empuja la barra en línea recta por encima de la cabeza.',
    'Baja controlado al pecho.',
  ], { role: 'main', aka: ['overhead press', 'ohp', 'press de hombro'] }),
  x('press-hombro-mancuernas', 'Press de hombro con mancuernas', 'hombros', 'triceps', 'mancuernas', 'compuesto', W, 'principiante', 'press-v', 'ohp-db', [
    'Sentado o de pie, mancuernas a la altura de los hombros.',
    'Empuja hacia arriba hasta estirar los brazos.',
    'Baja hasta la altura de las orejas.',
  ], { role: 'main', aka: ['dumbbell shoulder press'] }),
  x('press-arnold', 'Press Arnold', 'hombros', 'triceps', 'mancuernas', 'compuesto', W, 'intermedio', 'press-v', 'ohp-db', [
    'Empieza con las mancuernas delante de los hombros y las palmas hacia ti.',
    'Gira las muñecas mientras empujas hacia arriba.',
    'Al bajar, vuelve a girar a la posición inicial.',
  ], { aka: ['arnold press'] }),
  x('press-hombro-maquina', 'Press de hombro en máquina', 'hombros', 'triceps', 'maquina', 'compuesto', W, 'principiante', 'press-v', 'ohp-machine', [
    'Ajusta el asiento para que las asas queden a la altura de los hombros.',
    'Empuja por encima de la cabeza.',
    'Baja despacio.',
  ]),
  x('elevaciones-laterales', 'Elevaciones laterales', 'hombros', '', 'mancuernas', 'aislamiento', W, 'principiante', 'lateral', 'lateral-db', [
    'De pie con una mancuerna en cada mano a los lados.',
    'Eleva los brazos hacia los lados hasta la altura de los hombros.',
    'Baja despacio.',
  ], { aka: ['lateral raise', 'vuelos laterales'] }),
  x('elevaciones-laterales-polea', 'Elevaciones laterales en polea', 'hombros', '', 'polea', 'aislamiento', W, 'principiante', 'lateral', 'lateral-cable', [
    'De lado a la polea baja, agarre en la mano más alejada.',
    'Eleva el brazo hacia el lado hasta la altura del hombro.',
    'Baja controlando.',
  ]),
  x('elevaciones-frontales', 'Elevaciones frontales', 'hombros', 'pecho', 'mancuernas', 'aislamiento', W, 'principiante', 'front-raise', 'front-raise', [
    'De pie con las mancuernas delante de los muslos.',
    'Eleva los brazos al frente hasta la altura de los ojos.',
    'Baja despacio.',
  ], { aka: ['front raise'] }),
  x('pajaros', 'Pájaros con mancuernas', 'hombros', 'espalda', 'mancuernas', 'aislamiento', W, 'principiante', 'rear', 'rear-fly', [
    'Inclina el tronco hacia delante con la espalda neutra.',
    'Abre los brazos hacia los lados.',
    'Baja despacio.',
  ], { aka: ['rear delt fly', 'reverse fly'] }),
  x('reverse-pec-deck', 'Contractor inverso', 'hombros', 'espalda', 'maquina', 'aislamiento', W, 'principiante', 'rear', 'reverse-pec-deck', [
    'Siéntate mirando a la máquina con el pecho apoyado.',
    'Abre los brazos hacia atrás con los codos algo flexionados.',
    'Vuelve despacio.',
  ]),
  x('remo-al-menton', 'Remo al mentón', 'hombros', 'espalda', 'barra', 'compuesto', W, 'intermedio', 'lateral', 'upright-row', [
    'De pie con la barra delante de los muslos y agarre medio.',
    'Eleva la barra pegada al cuerpo hasta la altura del pecho.',
    'Baja despacio.',
  ], { aka: ['upright row'], tips: ['No subas por encima del pecho si notas molestias en el hombro.'] }),
  x('pino-flexiones', 'Flexiones en pino', 'hombros', 'triceps', 'peso_corporal', 'compuesto', BW, 'avanzado', 'press-v', 'handstand-pushup', [
    'Colócate boca abajo con los pies apoyados en la pared.',
    'Baja la cabeza hacia el suelo doblando los codos.',
    'Empuja hasta estirar los brazos.',
  ], { aka: ['handstand push up'], tips: ['Pon una esterilla bajo la cabeza y practica primero las flexiones pike.'] }),
  // Nuevos
  x('press-kettlebell', 'Press de hombro con kettlebell', 'hombros', 'triceps abdominales', 'kettlebell', 'compuesto', W, 'intermedio', 'press-v', 'ohp-kb', [
    'Sujeta la kettlebell a la altura del hombro con la bola sobre el antebrazo.',
    'Empuja por encima de la cabeza con la muñeca recta.',
    'Baja controlado al hombro.',
  ], { aka: ['kettlebell press'] }),
  x('press-hombro-banda', 'Press de hombro con banda', 'hombros', 'triceps', 'banda', 'compuesto', BW, 'principiante', 'press-v', 'ohp-band', [
    'Pisa la banda y sujeta los extremos a la altura de los hombros.',
    'Empuja por encima de la cabeza.',
    'Baja despacio.',
  ]),
  x('push-press', 'Push press', 'hombros', 'triceps cuadriceps', 'barra', 'compuesto', W, 'avanzado', 'press-v', 'ohp-bar', [
    'Barra sobre la parte alta del pecho, como en el press militar.',
    'Flexiona ligeramente las rodillas y extiéndelas con fuerza.',
    'Aprovecha el impulso para llevar la barra arriba y bloquear los brazos.',
  ], { aka: ['push press'] }),
  x('elevaciones-laterales-banda', 'Elevaciones laterales con banda', 'hombros', '', 'banda', 'aislamiento', BW, 'principiante', 'lateral', 'lateral-band', [
    'Pisa la banda y sujeta un extremo en cada mano.',
    'Eleva los brazos hacia los lados hasta la altura de los hombros.',
    'Baja despacio.',
  ]),
  x('pajaros-polea', 'Pájaros en polea', 'hombros', 'espalda', 'polea', 'aislamiento', W, 'intermedio', 'rear', 'rear-fly-cable', [
    'Inclina el tronco junto a una polea baja con el agarre en la mano contraria.',
    'Abre el brazo hacia fuera en arco hasta la altura del hombro.',
    'Vuelve despacio.',
  ], { aka: ['cable rear delt fly'] }),
  x('face-pull-banda', 'Face pull con banda', 'hombros', 'espalda', 'banda', 'aislamiento', BW, 'principiante', 'rear', 'face-pull', [
    'Ancla la banda a la altura de la cara.',
    'Tira hacia la cara separando las manos.',
    'Vuelve despacio.',
  ]),
  x('elevacion-frontal-disco', 'Elevación frontal con disco', 'hombros', 'pecho', 'otros', 'aislamiento', W, 'principiante', 'front-raise', 'front-raise-plate', [
    'Sujeta un disco con las dos manos delante de los muslos.',
    'Elévalo al frente hasta la altura de los ojos.',
    'Baja despacio.',
  ], { aka: ['plate front raise'] }),
  x('flexiones-pike', 'Flexiones pike', 'hombros', 'triceps', 'peso_corporal', 'compuesto', BW, 'intermedio', 'press-v', 'pike-pushup', [
    'Forma una V invertida con las manos y los pies en el suelo.',
    'Baja la cabeza hacia el suelo entre las manos.',
    'Empuja hasta estirar los brazos.',
  ], { aka: ['pike push up'] }),
  x('separacion-banda', 'Separación de banda', 'hombros', 'espalda', 'banda', 'aislamiento', BW, 'principiante', 'rear', 'pull-apart', [
    'Sujeta la banda delante del pecho con los brazos estirados.',
    'Sepárala llevando las manos hacia los lados.',
    'Vuelve despacio.',
  ], { aka: ['band pull apart'] }),
];
