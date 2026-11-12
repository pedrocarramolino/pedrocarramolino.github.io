// Bíceps, tríceps y antebrazos.
import { BW, DD, T, W, x, type CatalogEntry } from './types';

export const BICEPS: CatalogEntry[] = [
  x('curl-barra', 'Curl con barra', 'biceps', 'antebrazos', 'barra', 'aislamiento', W, 'principiante', 'curl', 'curl-bar', [
    'De pie con la barra delante de los muslos y las palmas hacia delante.',
    'Dobla los codos llevando la barra hacia los hombros.',
    'Baja despacio hasta casi estirar los brazos.',
  ], { role: 'sec', aka: ['barbell curl', 'curl de bíceps'] }),
  x('curl-barra-z', 'Curl con barra Z', 'biceps', 'antebrazos', 'barra', 'aislamiento', W, 'principiante', 'curl', 'curl-ez', [
    'Agarra la barra Z por las curvas, con las muñecas algo giradas.',
    'Dobla los codos sin moverlos de los costados.',
    'Baja controlando.',
  ], { role: 'sec', aka: ['ez bar curl'] }),
  x('curl-mancuernas', 'Curl con mancuernas', 'biceps', 'antebrazos', 'mancuernas', 'aislamiento', W, 'principiante', 'curl', 'curl-db', [
    'De pie con una mancuerna en cada mano y los brazos estirados.',
    'Sube las mancuernas girando las palmas hacia arriba.',
    'Baja despacio. Puedes alternar los brazos.',
  ], { role: 'sec', aka: ['dumbbell curl', 'curl de bíceps'] }),
  x('curl-martillo', 'Curl martillo', 'biceps', 'antebrazos', 'mancuernas', 'aislamiento', W, 'principiante', 'curl', 'curl-db', [
    'Sujeta las mancuernas con las palmas enfrentadas.',
    'Dobla los codos manteniendo ese agarre.',
    'Baja controlando.',
  ], { aka: ['hammer curl'] }),
  x('curl-inclinado', 'Curl inclinado con mancuernas', 'biceps', '', 'mancuernas', 'aislamiento', W, 'intermedio', 'curl', 'curl-incline', [
    'Siéntate en un banco inclinado a 45° y deja los brazos colgando.',
    'Dobla los codos sin adelantarlos.',
    'Baja hasta estirar del todo.',
  ], { aka: ['incline curl'] }),
  x('curl-predicador', 'Curl en banco Scott', 'biceps', '', 'barra', 'aislamiento', W, 'principiante', 'curl', 'curl-preacher', [
    'Apoya la parte de atrás de los brazos en el banco.',
    'Sube la barra doblando los codos.',
    'Baja hasta casi estirar, sin rebotar.',
  ], { aka: ['preacher curl', 'curl predicador'] }),
  x('curl-polea', 'Curl en polea', 'biceps', '', 'polea', 'aislamiento', W, 'principiante', 'curl', 'curl-cable', [
    'De pie frente a la polea baja con una barra corta.',
    'Dobla los codos manteniéndolos fijos.',
    'Baja despacio.',
  ], { aka: ['cable curl'] }),
  x('curl-concentrado', 'Curl concentrado', 'biceps', '', 'mancuernas', 'aislamiento', W, 'principiante', 'curl', 'curl-concentration', [
    'Sentado, apoya el codo en la cara interna del muslo.',
    'Sube la mancuerna lentamente.',
    'Baja hasta estirar el brazo.',
  ], { aka: ['concentration curl'] }),
  x('curl-banda', 'Curl con banda elástica', 'biceps', '', 'banda', 'aislamiento', BW, 'principiante', 'curl', 'curl-band', [
    'Pisa la banda y sujeta un extremo en cada mano.',
    'Dobla los codos llevando las manos a los hombros.',
    'Baja despacio.',
  ]),
  // Nuevos
  x('curl-kettlebell', 'Curl con kettlebell', 'biceps', 'antebrazos', 'kettlebell', 'aislamiento', W, 'principiante', 'curl', 'curl-kb', [
    'Sujeta la kettlebell por el asa con el brazo estirado.',
    'Dobla el codo llevándola hacia el hombro.',
    'Baja controlando.',
  ]),
  x('curl-martillo-cuerda', 'Curl martillo en polea con cuerda', 'biceps', 'antebrazos', 'polea', 'aislamiento', W, 'principiante', 'curl', 'curl-cable', [
    'Coloca la cuerda en la polea baja y agárrala con las palmas enfrentadas.',
    'Dobla los codos sin separarlos del cuerpo.',
    'Baja despacio.',
  ], { aka: ['rope hammer curl'] }),
  x('curl-arana', 'Curl araña', 'biceps', '', 'mancuernas', 'aislamiento', W, 'intermedio', 'curl', 'curl-preacher', [
    'Túmbate boca abajo en un banco inclinado con los brazos colgando.',
    'Sube las mancuernas doblando los codos.',
    'Baja hasta estirar los brazos.',
  ], { aka: ['spider curl'] }),
  x('curl-predicador-mancuerna', 'Curl predicador con mancuerna', 'biceps', '', 'mancuernas', 'aislamiento', W, 'principiante', 'curl', 'curl-preacher', [
    'Apoya un brazo en el banco Scott con una mancuerna.',
    'Sube doblando el codo.',
    'Baja hasta casi estirar.',
  ]),
  x('curl-maquina', 'Curl de bíceps en máquina', 'biceps', '', 'maquina', 'aislamiento', W, 'principiante', 'curl', 'curl-preacher', [
    'Ajusta el asiento para que los codos queden alineados con el eje.',
    'Dobla los codos hasta arriba.',
    'Baja controlando.',
  ], { aka: ['machine curl'] }),
  x('curl-zottman', 'Curl Zottman', 'biceps', 'antebrazos', 'mancuernas', 'aislamiento', W, 'intermedio', 'curl', 'curl-db', [
    'Sube las mancuernas con las palmas hacia arriba.',
    'Arriba, gira las palmas hacia abajo.',
    'Baja despacio con ese agarre y vuelve a girar abajo.',
  ], { aka: ['zottman curl'] }),
  x('curl-inverso', 'Curl inverso con barra', 'biceps', 'antebrazos', 'barra', 'aislamiento', W, 'principiante', 'curl', 'curl-bar', [
    'Agarra la barra con las palmas hacia abajo.',
    'Dobla los codos llevando la barra a los hombros.',
    'Baja despacio.',
  ], { aka: ['reverse curl'] }),
  x('curl-21', 'Curl 21', 'biceps', 'antebrazos', 'barra', 'aislamiento', W, 'intermedio', 'curl', 'curl-bar', [
    'Haz 7 repeticiones de la parte baja (de abajo a la mitad).',
    'Haz 7 de la parte alta (de la mitad a arriba).',
    'Termina con 7 repeticiones completas.',
  ], { aka: ['21s'], tips: ['Usa menos peso que en el curl normal: son 21 repeticiones seguidas.'] }),
];

export const TRICEPS: CatalogEntry[] = [
  x('press-cerrado', 'Press de banca agarre cerrado', 'triceps', 'pecho hombros', 'barra', 'compuesto', W, 'intermedio', 'press-h', 'bench-bar', [
    'Túmbate en el banco y agarra la barra a la anchura de los hombros.',
    'Baja la barra al pecho con los codos cerca del cuerpo.',
    'Empuja hasta estirar los brazos.',
  ], { role: 'main', aka: ['close grip bench press'] }),
  x('extension-polea', 'Extensión de tríceps en polea', 'triceps', '', 'polea', 'aislamiento', W, 'principiante', 'tri-ext', 'pushdown-bar', [
    'De pie frente a la polea alta con una barra corta.',
    'Con los codos pegados, estira los brazos hacia abajo.',
    'Sube despacio hasta que los antebrazos queden horizontales.',
  ], { role: 'sec', aka: ['triceps pushdown', 'jalón de tríceps'] }),
  x('extension-cuerda', 'Extensión con cuerda en polea', 'triceps', '', 'polea', 'aislamiento', W, 'principiante', 'tri-ext', 'pushdown-rope', [
    'Agarra la cuerda en la polea alta.',
    'Estira los brazos hacia abajo y separa las manos al final.',
    'Sube despacio.',
  ], { role: 'sec', aka: ['rope pushdown'] }),
  x('press-frances', 'Press francés', 'triceps', '', 'barra', 'aislamiento', W, 'intermedio', 'tri-ext', 'skullcrusher', [
    'Túmbate en el banco con la barra Z sobre el pecho y los brazos estirados.',
    'Baja la barra hacia la frente doblando sólo los codos.',
    'Estira los brazos de nuevo.',
  ], { role: 'sec', aka: ['skull crusher', 'rompecráneos'] }),
  x('extension-sobre-cabeza', 'Extensión de tríceps sobre la cabeza', 'triceps', '', 'mancuernas', 'aislamiento', W, 'principiante', 'tri-ext', 'overhead-ext', [
    'Sentado, sujeta una mancuerna con las dos manos sobre la cabeza.',
    'Bájala por detrás de la cabeza doblando los codos.',
    'Estira los brazos hacia arriba.',
  ], { aka: ['overhead extension'] }),
  x('patada-triceps', 'Patada de tríceps', 'triceps', '', 'mancuernas', 'aislamiento', W, 'principiante', 'tri-ext', 'kickback', [
    'Inclina el tronco con una mano apoyada en el banco.',
    'Con el codo fijo junto al cuerpo, estira el brazo hacia atrás.',
    'Vuelve despacio.',
  ], { aka: ['kickback'] }),
  x('fondos-banco', 'Fondos en banco', 'triceps', 'pecho', 'peso_corporal', 'compuesto', BW, 'principiante', 'dip', 'bench-dip', [
    'Apoya las manos en el borde de un banco o una silla firme.',
    'Baja doblando los codos con la espalda cerca del banco.',
    'Empuja hasta estirar los brazos.',
  ], { aka: ['bench dips'] }),
  // Nuevos
  x('flexiones-diamante', 'Flexiones diamante', 'triceps', 'pecho hombros', 'peso_corporal', 'compuesto', BW, 'intermedio', 'pushup', 'pushup', [
    'Junta las manos bajo el pecho formando un rombo con los dedos.',
    'Baja el pecho hacia las manos con los codos pegados.',
    'Empuja hasta estirar los brazos.',
  ], { aka: ['diamond push up', 'flexiones cerradas'] }),
  x('extension-banda', 'Extensión de tríceps con banda', 'triceps', '', 'banda', 'aislamiento', BW, 'principiante', 'tri-ext', 'pushdown-band', [
    'Ancla la banda en lo alto de una puerta.',
    'Con los codos pegados, estira los brazos hacia abajo.',
    'Sube despacio.',
  ]),
  x('extension-sobre-cabeza-polea', 'Extensión sobre la cabeza en polea', 'triceps', '', 'polea', 'aislamiento', W, 'intermedio', 'tri-ext', 'overhead-ext-cable', [
    'De espaldas a la polea, sujeta la cuerda detrás de la cabeza.',
    'Estira los brazos hacia delante y arriba.',
    'Vuelve doblando los codos.',
  ], { aka: ['cable overhead extension'] }),
  x('press-frances-mancuernas', 'Press francés con mancuernas', 'triceps', '', 'mancuernas', 'aislamiento', W, 'principiante', 'tri-ext', 'skullcrusher', [
    'Túmbate con una mancuerna en cada mano y los brazos estirados.',
    'Baja las mancuernas junto a la cabeza doblando los codos.',
    'Estira los brazos.',
  ]),
  x('fondos-maquina', 'Fondos de tríceps en máquina', 'triceps', 'pecho', 'maquina', 'compuesto', W, 'principiante', 'dip', 'dip-assisted', [
    'Siéntate en la máquina con las asas a los lados.',
    'Empuja hacia abajo hasta estirar los brazos.',
    'Sube despacio.',
  ], { aka: ['machine dip'] }),
  x('extension-kettlebell', 'Extensión de tríceps con kettlebell', 'triceps', '', 'kettlebell', 'aislamiento', W, 'principiante', 'tri-ext', 'overhead-ext-kb', [
    'Sujeta la kettlebell por el asa con las dos manos sobre la cabeza.',
    'Bájala por detrás de la cabeza.',
    'Estira los brazos.',
  ]),
  x('extension-unilateral-polea', 'Extensión de tríceps a una mano en polea', 'triceps', '', 'polea', 'aislamiento', W, 'principiante', 'tri-ext', 'pushdown-bar', [
    'Agarra el asa de la polea alta con una mano.',
    'Con el codo pegado, estira el brazo hacia abajo.',
    'Sube despacio.',
  ]),
];

export const FOREARMS: CatalogEntry[] = [
  x('curl-muneca', 'Curl de muñeca', 'antebrazos', '', 'barra', 'aislamiento', W, 'principiante', 'wrist', 'wrist-curl', [
    'Apoya los antebrazos en el banco con las palmas hacia arriba.',
    'Flexiona las muñecas hacia arriba.',
    'Baja despacio.',
  ], { aka: ['wrist curl'] }),
  x('curl-muneca-inverso', 'Curl de muñeca inverso', 'antebrazos', '', 'barra', 'aislamiento', W, 'principiante', 'wrist', 'wrist-curl', [
    'Apoya los antebrazos con las palmas hacia abajo.',
    'Extiende las muñecas hacia arriba.',
    'Baja despacio.',
  ]),
  x('paseo-granjero', 'Paseo del granjero', 'antebrazos', 'espalda abdominales cuerpo_completo', 'mancuernas', 'compuesto', DD, 'principiante', 'carry', 'farmer', [
    'Coge una carga pesada en cada mano.',
    'Camina erguido con pasos cortos y firmes.',
    'Registra distancia y tiempo.',
  ], { aka: ['farmer walk', 'farmer carry'] }),
  x('colgado-barra', 'Colgado en barra', 'antebrazos', 'espalda', 'peso_corporal', 'aislamiento', T, 'principiante', 'hang', 'dead-hang', [
    'Agarra la barra con los brazos estirados.',
    'Aguanta colgado el mayor tiempo posible.',
    'Bájate con cuidado.',
  ], { gym: true, aka: ['dead hang'] }),
  // Nuevos
  x('paseo-granjero-kettlebell', 'Paseo del granjero con kettlebell', 'antebrazos', 'espalda abdominales', 'kettlebell', 'compuesto', DD, 'principiante', 'carry', 'farmer-kb', [
    'Coge una kettlebell en cada mano por el asa.',
    'Camina erguido con los hombros abajo.',
    'Registra distancia y tiempo.',
  ]),
  x('curl-muneca-mancuerna', 'Curl de muñeca con mancuerna', 'antebrazos', '', 'mancuernas', 'aislamiento', W, 'principiante', 'wrist', 'wrist-curl', [
    'Apoya el antebrazo en el muslo o el banco con la palma hacia arriba.',
    'Flexiona la muñeca hacia arriba.',
    'Baja despacio.',
  ]),
  x('sujecion-discos', 'Sujeción de discos en pinza', 'antebrazos', '', 'otros', 'aislamiento', T, 'principiante', 'carry', 'farmer', [
    'Junta dos discos lisos y sujétalos con los dedos por el borde.',
    'Mantén los brazos estirados a los lados.',
    'Aguanta el mayor tiempo posible.',
  ], { aka: ['pinch grip'] }),
];
