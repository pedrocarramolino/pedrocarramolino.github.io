// Core y abdomen, cuerpo completo, cardio y movilidad.
import { BW, DD, T, W, x, type CatalogEntry } from './types';

export const CORE: CatalogEntry[] = [
  x('plancha', 'Plancha', 'abdominales', 'hombros', 'peso_corporal', 'aislamiento', T, 'principiante', 'core-stab', 'plank', [
    'Apoya los antebrazos bajo los hombros y las puntas de los pies.',
    'Cuerpo recto de la cabeza a los talones.',
    'Aguanta el tiempo indicado respirando con normalidad.',
  ], { role: 'sec', aka: ['plank'] }),
  x('plancha-lateral', 'Plancha lateral', 'abdominales', '', 'peso_corporal', 'aislamiento', T, 'principiante', 'core-stab', 'side-plank', [
    'De lado, apoya un antebrazo bajo el hombro.',
    'Eleva la cadera hasta alinear el cuerpo.',
    'Aguanta y cambia de lado.',
  ], { aka: ['side plank'] }),
  x('crunch', 'Crunch abdominal', 'abdominales', '', 'peso_corporal', 'aislamiento', BW, 'principiante', 'core-flex', 'crunch', [
    'Túmbate boca arriba con las rodillas dobladas.',
    'Eleva los hombros del suelo enrollando el tronco.',
    'Baja despacio sin tirar del cuello.',
  ], { aka: ['crunch', 'abdominales'] }),
  x('crunch-polea', 'Crunch en polea', 'abdominales', '', 'polea', 'aislamiento', W, 'intermedio', 'core-flex', 'cable-crunch', [
    'De rodillas frente a la polea alta con la cuerda junto a la cabeza.',
    'Flexiona el tronco llevando los codos hacia los muslos.',
    'Vuelve despacio.',
  ], { role: 'sec', aka: ['cable crunch'] }),
  x('elevacion-piernas', 'Elevación de piernas colgado', 'abdominales', 'antebrazos', 'peso_corporal', 'aislamiento', BW, 'intermedio', 'core-flex', 'hanging-leg-raise', [
    'Cuélgate de la barra con los brazos estirados.',
    'Eleva las piernas sin balancearte.',
    'Baja despacio.',
  ], { role: 'sec', gym: true, aka: ['hanging leg raise'] }),
  x('rueda-abdominal', 'Rueda abdominal', 'abdominales', 'hombros', 'otros', 'aislamiento', BW, 'intermedio', 'core-stab', 'ab-wheel', [
    'De rodillas, sujeta la rueda bajo los hombros.',
    'Rueda hacia delante con el abdomen firme.',
    'Vuelve tirando con el abdomen sin arquear la espalda.',
  ], { role: 'sec', aka: ['ab wheel', 'rollout'] }),
  x('russian-twist', 'Giros rusos', 'abdominales', '', 'peso_corporal', 'aislamiento', BW, 'principiante', 'core-rot', 'russian-twist', [
    'Sentado con el tronco inclinado hacia atrás y los pies apoyados o en el aire.',
    'Gira el tronco hacia un lado y después al otro.',
    'Puedes sujetar un disco o una mancuerna.',
  ], { aka: ['russian twist'] }),
  x('pallof', 'Press Pallof', 'abdominales', '', 'polea', 'aislamiento', W, 'principiante', 'core-rot', 'pallof', [
    'De lado a la polea, sujeta el agarre junto al pecho.',
    'Estira los brazos al frente sin dejar que el tronco gire.',
    'Vuelve despacio al pecho.',
  ], { aka: ['pallof press'] }),
  x('dead-bug', 'Dead bug', 'abdominales', '', 'peso_corporal', 'aislamiento', BW, 'principiante', 'core-stab', 'dead-bug', [
    'Boca arriba con los brazos hacia el techo y las rodillas a 90°.',
    'Estira a la vez un brazo y la pierna contraria.',
    'Vuelve y cambia de lado sin despegar la zona lumbar.',
  ], { aka: ['bicho muerto'] }),
  // Nuevos
  x('crunch-bicicleta', 'Crunch bicicleta', 'abdominales', '', 'peso_corporal', 'aislamiento', BW, 'principiante', 'core-rot', 'bicycle', [
    'Boca arriba con las manos junto a la cabeza y las piernas en el aire.',
    'Lleva un codo hacia la rodilla contraria mientras estiras la otra pierna.',
    'Alterna los lados de forma controlada.',
  ], { aka: ['bicycle crunch'] }),
  x('elevacion-piernas-tumbado', 'Elevación de piernas tumbado', 'abdominales', '', 'peso_corporal', 'aislamiento', BW, 'principiante', 'core-flex', 'leg-raise-lying', [
    'Túmbate boca arriba con los brazos a los lados.',
    'Eleva las piernas estiradas hasta la vertical.',
    'Bájalas despacio sin despegar la zona lumbar.',
  ], { aka: ['lying leg raise'] }),
  x('hollow', 'Hollow hold', 'abdominales', '', 'peso_corporal', 'aislamiento', T, 'intermedio', 'core-stab', 'hollow', [
    'Boca arriba, despega hombros y piernas del suelo.',
    'Brazos estirados por encima de la cabeza y zona lumbar pegada al suelo.',
    'Aguanta el tiempo indicado.',
  ], { aka: ['hollow body'] }),
  x('mountain-climbers', 'Escaladores', 'abdominales', 'hombros cuadriceps', 'peso_corporal', 'compuesto', BW, 'principiante', 'core-stab', 'mountain-climber', [
    'Colócate en plancha con los brazos estirados.',
    'Lleva una rodilla hacia el pecho.',
    'Cambia de pierna a buen ritmo sin subir la cadera.',
  ], { aka: ['mountain climbers'] }),
  x('bird-dog', 'Bird dog', 'abdominales', 'gluteos espalda', 'peso_corporal', 'aislamiento', BW, 'principiante', 'core-stab', 'bird-dog', [
    'Ponte a cuatro patas con las manos bajo los hombros.',
    'Estira a la vez un brazo al frente y la pierna contraria atrás.',
    'Vuelve despacio y cambia de lado.',
  ], { aka: ['perro de caza'] }),
  x('lenador-polea', 'Leñador en polea', 'abdominales', 'hombros', 'polea', 'compuesto', W, 'intermedio', 'core-rot', 'woodchop', [
    'De lado a la polea alta, agarre con las dos manos.',
    'Tira en diagonal hacia la cadera contraria girando el tronco.',
    'Vuelve despacio.',
  ], { aka: ['woodchop', 'cable woodchopper'] }),
  x('crunch-inverso', 'Crunch inverso', 'abdominales', '', 'peso_corporal', 'aislamiento', BW, 'principiante', 'core-flex', 'reverse-crunch', [
    'Boca arriba con las rodillas dobladas en el aire.',
    'Lleva las rodillas al pecho despegando un poco la cadera.',
    'Baja despacio.',
  ], { aka: ['reverse crunch'] }),
  x('plancha-toque-hombro', 'Plancha con toque de hombro', 'abdominales', 'hombros', 'peso_corporal', 'aislamiento', BW, 'principiante', 'core-stab', 'renegade-row', [
    'En plancha con los brazos estirados y los pies separados.',
    'Toca el hombro contrario con una mano sin mover la cadera.',
    'Alterna las manos.',
  ], { aka: ['shoulder taps'] }),
  x('pallof-banda', 'Press Pallof con banda', 'abdominales', '', 'banda', 'aislamiento', BW, 'principiante', 'core-rot', 'pallof', [
    'Ancla la banda a la altura del pecho y colócate de lado.',
    'Estira los brazos al frente resistiendo el giro.',
    'Vuelve despacio.',
  ]),
  x('elevacion-rodillas-paralelas', 'Elevación de rodillas en paralelas', 'abdominales', '', 'peso_corporal', 'aislamiento', BW, 'principiante', 'core-flex', 'hanging-leg-raise', [
    'Apoya los antebrazos en el aparato con la espalda en el respaldo.',
    'Sube las rodillas hacia el pecho.',
    'Baja despacio sin balancearte.',
  ], { gym: true, aka: ['captain chair'] }),
  x('sit-up', 'Abdominal completo', 'abdominales', '', 'peso_corporal', 'aislamiento', BW, 'principiante', 'core-flex', 'crunch', [
    'Boca arriba con las rodillas dobladas y los pies sujetos.',
    'Sube el tronco hasta quedar sentado.',
    'Baja despacio vértebra a vértebra.',
  ], { aka: ['sit up'] }),
  x('paseo-maleta', 'Paseo de maleta con kettlebell', 'abdominales', 'antebrazos espalda', 'kettlebell', 'compuesto', DD, 'principiante', 'carry', 'farmer-kb', [
    'Coge una kettlebell sólo en una mano.',
    'Camina erguido sin inclinarte hacia el lado de la carga.',
    'Cambia de mano a mitad de recorrido.',
  ], { aka: ['suitcase carry'] }),
];

export const FULL_BODY: CatalogEntry[] = [
  x('cargada', 'Cargada de potencia', 'cuerpo_completo', 'cuadriceps espalda hombros', 'barra', 'compuesto', W, 'avanzado', 'power', 'clean', [
    'Barra sobre el centro del pie, agarre algo más ancho que las piernas.',
    'Extiende de forma explosiva cadera y rodillas.',
    'Mete los codos rápido y recibe la barra sobre los hombros.',
  ], { role: 'main', aka: ['power clean'] }),
  x('arrancada', 'Arrancada', 'cuerpo_completo', 'hombros cuadriceps', 'barra', 'compuesto', W, 'avanzado', 'power', 'snatch', [
    'Agarre muy abierto y barra sobre el centro del pie.',
    'Lleva la barra del suelo a encima de la cabeza en un solo movimiento.',
    'Recíbela con los brazos bloqueados y ponte de pie.',
  ], { role: 'main', aka: ['snatch'] }),
  x('thruster', 'Thruster', 'cuerpo_completo', 'cuadriceps hombros', 'barra', 'compuesto', W, 'intermedio', 'power', 'thruster', [
    'Barra sobre la parte delantera de los hombros.',
    'Haz una sentadilla frontal.',
    'Al subir, empuja la barra por encima de la cabeza en un solo movimiento.',
  ], { role: 'main' }),
  x('kettlebell-swing', 'Swing con kettlebell', 'cuerpo_completo', 'gluteos isquios', 'kettlebell', 'compuesto', W, 'intermedio', 'power', 'kb-swing', [
    'Pies algo más abiertos que la cadera y la kettlebell delante.',
    'Llévala entre las piernas con una bisagra de cadera.',
    'Extiende la cadera con fuerza para impulsarla hasta la altura del pecho.',
  ], { aka: ['kettlebell swing', 'swing ruso'] }),
  x('burpees', 'Burpees', 'cuerpo_completo', 'pecho cuadriceps', 'peso_corporal', 'compuesto', BW, 'principiante', 'plyo', 'burpee', [
    'Agáchate y apoya las manos en el suelo.',
    'Lleva los pies atrás a plancha y haz una flexión.',
    'Recoge los pies y salta con los brazos arriba.',
  ], { aka: ['burpee'] }),
  x('turkish-getup', 'Turkish get-up', 'cuerpo_completo', 'hombros abdominales', 'kettlebell', 'compuesto', W, 'avanzado', 'power', 'get-up', [
    'Tumbado con una kettlebell en un brazo estirado hacia el techo.',
    'Pasa por fases hasta ponerte de pie sin bajar el brazo.',
    'Vuelve al suelo en orden inverso.',
  ], { aka: ['tgu', 'levantamiento turco'], tips: ['Aprende las fases sin peso o con un zapato en la mano.'] }),
  // Nuevos
  x('thruster-mancuernas', 'Thruster con mancuernas', 'cuerpo_completo', 'cuadriceps hombros', 'mancuernas', 'compuesto', W, 'principiante', 'power', 'thruster-db', [
    'Mancuernas sobre los hombros.',
    'Haz una sentadilla.',
    'Al subir, empuja las mancuernas por encima de la cabeza.',
  ], { role: 'main' }),
  x('saltos-tijera', 'Saltos de tijera', 'cuerpo_completo', 'gemelos hombros', 'peso_corporal', 'cardio', BW, 'principiante', 'plyo', 'jumping-jack', [
    'De pie con los pies juntos y los brazos a los lados.',
    'Salta abriendo piernas y brazos por encima de la cabeza.',
    'Salta de nuevo para volver a la posición inicial.',
  ], { aka: ['jumping jacks'] }),
  x('lanzamiento-balon', 'Lanzamiento de balón medicinal al suelo', 'cuerpo_completo', 'abdominales hombros espalda', 'otros', 'compuesto', W, 'principiante', 'power', 'slam', [
    'De pie con el balón por encima de la cabeza.',
    'Lánzalo con fuerza contra el suelo doblando la cadera.',
    'Recógelo con la espalda neutra y repite.',
  ], { aka: ['medicine ball slam', 'ball slam'], tips: ['Usa un balón sin rebote para que no te golpee al volver.'] }),
  x('cargada-press-kettlebell', 'Cargada y press con kettlebell', 'cuerpo_completo', 'hombros gluteos', 'kettlebell', 'compuesto', W, 'intermedio', 'power', 'ohp-kb', [
    'Kettlebell entre los pies, agárrala con una mano.',
    'Súbela al hombro con un impulso de cadera.',
    'Empújala por encima de la cabeza y baja en orden inverso.',
  ], { aka: ['kettlebell clean and press'] }),
  x('swing-una-mano', 'Swing a una mano con kettlebell', 'cuerpo_completo', 'gluteos isquios abdominales', 'kettlebell', 'compuesto', W, 'intermedio', 'power', 'kb-swing', [
    'Agarra la kettlebell con una sola mano.',
    'Llévala entre las piernas con una bisagra de cadera.',
    'Impúlsala hasta la altura del pecho sin girar el tronco.',
  ], { aka: ['one arm swing'] }),
];

export const CARDIO: CatalogEntry[] = [
  x('correr', 'Correr', 'cardio', '', 'otros', 'cardio', DD, 'principiante', 'cardio', 'run', ['Empieza a ritmo suave unos minutos.', 'Mantén un paso cómodo y respira con ritmo.', 'Registra distancia y tiempo.'], { aka: ['running', 'trotar'], home: true }),
  x('cinta', 'Cinta de correr', 'cardio', '', 'maquina', 'cardio', DD, 'principiante', 'cardio', 'treadmill', ['Sube a la cinta parada y ponte la pinza de seguridad.', 'Aumenta la velocidad poco a poco.', 'Registra distancia y tiempo.'], { aka: ['treadmill'] }),
  x('bicicleta', 'Bicicleta estática', 'cardio', '', 'maquina', 'cardio', DD, 'principiante', 'cardio', 'bike', ['Ajusta el sillín a la altura de la cadera.', 'Pedalea a ritmo constante.', 'Registra distancia y tiempo.'], { aka: ['bike', 'spinning'] }),
  x('remo-ergometro', 'Remoergómetro', 'cardio', 'espalda', 'maquina', 'cardio', DD, 'principiante', 'cardio', 'rower', ['Empuja primero con las piernas.', 'Después inclina el tronco y tira con los brazos.', 'Vuelve en orden inverso: brazos, tronco y piernas.'], { aka: ['rowing machine', 'remo'] }),
  x('eliptica', 'Elíptica', 'cardio', '', 'maquina', 'cardio', DD, 'principiante', 'cardio', 'elliptical', ['Sube a la máquina y agarra las asas.', 'Pedalea manteniendo la espalda erguida.', 'Registra distancia y tiempo.']),
  x('comba', 'Comba', 'cardio', 'gemelos', 'otros', 'cardio', T, 'principiante', 'cardio', 'jump-rope', ['Sujeta la comba con los codos cerca del cuerpo.', 'Gira la cuerda con las muñecas.', 'Salta con saltos cortos sobre las puntas.'], { aka: ['jump rope', 'saltar a la cuerda'], home: true }),
  x('caminar', 'Caminar', 'cardio', '', 'otros', 'cardio', DD, 'principiante', 'cardio', 'walk', ['Camina a paso ligero.', 'Mantén los brazos sueltos y la espalda erguida.', 'Registra distancia y tiempo.'], { aka: ['walking', 'andar'], home: true }),
  x('escaladora', 'Escaladora', 'cardio', 'gluteos', 'maquina', 'cardio', T, 'principiante', 'cardio', 'stair', ['Sube a la máquina y agárrate sin apoyar todo el peso.', 'Sube escalones a ritmo constante.', 'Registra el tiempo.'], { aka: ['stair climber'] }),
];

export const MOBILITY: CatalogEntry[] = [
  x('movilidad-cadera', 'Movilidad de cadera 90/90', 'movilidad', 'gluteos', 'peso_corporal', 'movilidad', T, 'principiante', 'mobility', 'hip-90-90', ['Siéntate con ambas piernas dobladas a 90°.', 'Gira las rodillas hacia el otro lado sin usar las manos.', 'Alterna despacio.']),
  x('estiramiento-isquios', 'Estiramiento de isquiotibiales', 'movilidad', 'isquios', 'peso_corporal', 'movilidad', T, 'principiante', 'mobility', 'hamstring-stretch', ['Estira una pierna con el talón apoyado.', 'Inclina el tronco desde la cadera con la espalda recta.', 'Mantén el estiramiento sin rebotes.']),
  x('dislocaciones-banda', 'Dislocaciones de hombro con banda', 'movilidad', 'hombros', 'banda', 'movilidad', BW, 'principiante', 'mobility', 'band-dislocate', ['Sujeta la banda con los brazos estirados y un agarre ancho.', 'Pásala desde delante hasta detrás del cuerpo.', 'Vuelve por el mismo camino.'], { aka: ['shoulder dislocates'] }),
  x('gato-camello', 'Gato-camello', 'movilidad', 'espalda', 'peso_corporal', 'movilidad', BW, 'principiante', 'mobility', 'cat-cow', ['Ponte a cuatro patas.', 'Redondea la espalda hacia el techo.', 'Después arquéala suavemente mirando al frente.'], { aka: ['cat cow'] }),
  x('rotacion-toracica', 'Rotación torácica', 'movilidad', 'espalda', 'peso_corporal', 'movilidad', BW, 'principiante', 'mobility', 'thoracic-rotation', ['Ponte a cuatro patas con una mano detrás de la cabeza.', 'Gira el tronco abriendo el codo hacia el techo.', 'Vuelve despacio.']),
  x('tobillo-pared', 'Movilidad de tobillo en pared', 'movilidad', 'gemelos', 'peso_corporal', 'movilidad', BW, 'principiante', 'mobility', 'ankle-wall', ['Con un pie cerca de la pared, adelanta la rodilla hacia ella.', 'No levantes el talón.', 'Vuelve y repite.']),
];
