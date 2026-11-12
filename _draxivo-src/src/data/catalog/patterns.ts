// Consejos de seguridad y errores frecuentes comunes a cada patrón de movimiento.
// Cada ficha muestra primero los propios del ejercicio y después estos.
import type { Pattern } from './types';

export const PATTERN_LABEL: Record<Pattern, string> = {
  'press-h': 'Empuje horizontal',
  pushup: 'Flexiones',
  fly: 'Aperturas',
  dip: 'Fondos',
  pullover: 'Pullover',
  'pull-v': 'Tracción vertical',
  row: 'Remo',
  hinge: 'Bisagra de cadera',
  'back-ext': 'Extensión de espalda',
  shrug: 'Encogimientos',
  'press-v': 'Empuje vertical',
  lateral: 'Elevación lateral',
  'front-raise': 'Elevación frontal',
  rear: 'Deltoides posterior',
  curl: 'Flexión de codo',
  'tri-ext': 'Extensión de codo',
  wrist: 'Muñeca',
  carry: 'Acarreo',
  hang: 'Agarre colgado',
  squat: 'Sentadilla',
  lunge: 'Zancada y unilateral',
  'leg-machine': 'Máquina de pierna',
  'leg-curl': 'Flexión de rodilla',
  thrust: 'Extensión de cadera',
  abduct: 'Abducción y aducción',
  calf: 'Gemelos',
  'core-stab': 'Estabilidad del core',
  'core-flex': 'Flexión abdominal',
  'core-rot': 'Rotación y antirrotación',
  power: 'Potencia',
  plyo: 'Saltos y pliometría',
  cardio: 'Cardio',
  mobility: 'Movilidad',
};

export const PATTERN_GUIDE: Record<Pattern, { tips: string[]; mistakes: string[] }> = {
  'press-h': {
    tips: ['Junta y baja las escápulas antes de empezar y mantenlas así.', 'Apoya los pies con firmeza; los glúteos no se despegan del banco.', 'Con cargas altas usa topes de seguridad o pide a alguien que te ayude.'],
    mistakes: ['Rebotar la carga en el pecho.', 'Abrir los codos en cruz; mejor a unos 45–70° del torso.', 'Recortar el recorrido para mover más peso.'],
  },
  pushup: {
    tips: ['Cuerpo recto de la cabeza a los talones: aprieta glúteos y abdomen.', 'Manos bajo los hombros o algo más abiertas, dedos hacia delante.'],
    mistakes: ['Hundir la cadera o subirla demasiado.', 'Bajar sólo la cabeza en lugar de todo el pecho.', 'Abrir los codos en cruz.'],
  },
  fly: {
    tips: ['Mantén una ligera flexión de codos fija durante todo el movimiento.', 'Baja sólo hasta notar un estiramiento cómodo en el pecho.'],
    mistakes: ['Doblar y estirar los codos como si fuera un press.', 'Bajar demasiado y forzar el hombro.'],
  },
  dip: {
    tips: ['Baja hasta que el hombro quede a la altura del codo, o menos si notas molestias.', 'Mantén los hombros lejos de las orejas.'],
    mistakes: ['Dejarse caer sin control.', 'Encoger los hombros en la parte baja.'],
  },
  pullover: {
    tips: ['Mueve sólo los hombros; los codos casi no cambian de ángulo.', 'Mantén las costillas abajo y el abdomen firme.'],
    mistakes: ['Arquear la zona lumbar al llevar los brazos atrás.', 'Usar demasiado peso y perder el control.'],
  },
  'pull-v': {
    tips: ['Empieza bajando los hombros y después dobla los codos.', 'Controla la bajada hasta estirar los brazos.'],
    mistakes: ['Balancearse o dar tirones.', 'Hacer medio recorrido.', 'Llevar la cabeza hacia delante para llegar.'],
  },
  row: {
    tips: ['Espalda neutra y abdomen firme durante todo el recorrido.', 'Lleva los codos hacia atrás y junta las escápulas al final.'],
    mistakes: ['Redondear la espalda.', 'Tirar sólo con los brazos.', 'Usar impulso del tronco.'],
  },
  hinge: {
    tips: ['Lleva la cadera hacia atrás manteniendo la espalda neutra.', 'Mantén la carga pegada a las piernas.', 'Empieza con poco peso hasta dominar la técnica.'],
    mistakes: ['Redondear la zona lumbar.', 'Echar el tronco hacia atrás al final.', 'Separar la carga del cuerpo.'],
  },
  'back-ext': {
    tips: ['Sube despacio hasta alinear tronco y piernas.', 'Aprieta los glúteos al final del movimiento.'],
    mistakes: ['Arquear de más la zona lumbar.', 'Hacerlo con impulso.'],
  },
  shrug: {
    tips: ['Sube recto hacia las orejas y haz una pausa arriba.', 'Brazos relajados: sólo se mueven los hombros.'],
    mistakes: ['Girar los hombros en círculo.', 'Doblar los codos para ayudarte.'],
  },
  'press-v': {
    tips: ['Aprieta glúteos y abdomen para no arquear la espalda.', 'Empuja la carga en línea recta por encima de la cabeza.'],
    mistakes: ['Arquear la zona lumbar.', 'Empujar la carga por delante de la cara.', 'Bajar sólo hasta la mitad.'],
  },
  lateral: {
    tips: ['Usa poco peso y controla la bajada.', 'Sube hasta la altura de los hombros, no más.'],
    mistakes: ['Balancear el cuerpo.', 'Subir los hombros hacia las orejas.', 'Doblar mucho los codos.'],
  },
  'front-raise': {
    tips: ['Codos ligeramente flexionados y tronco quieto.', 'Sube hasta la altura de los ojos como mucho.'],
    mistakes: ['Echar el cuerpo hacia atrás.', 'Usar impulso para subir.'],
  },
  rear: {
    tips: ['Mueve los brazos en arco con los codos algo flexionados.', 'Piensa en llevar las manos hacia fuera, no hacia atrás.'],
    mistakes: ['Usar demasiado peso y tirar con toda la espalda.', 'Encoger los hombros.'],
  },
  curl: {
    tips: ['Codos pegados al cuerpo y quietos.', 'Baja hasta casi estirar el brazo.'],
    mistakes: ['Balancear el tronco.', 'Adelantar los codos al subir.', 'Bajar de golpe.'],
  },
  'tri-ext': {
    tips: ['Mantén los codos fijos: sólo se mueve el antebrazo.', 'Extiende del todo sin bloquear de golpe.'],
    mistakes: ['Abrir los codos hacia fuera.', 'Usar el hombro o el tronco para mover la carga.'],
  },
  wrist: {
    tips: ['Apoya bien el antebrazo y mueve sólo la muñeca.', 'Recorrido completo y lento.'],
    mistakes: ['Usar demasiado peso.', 'Mover el codo o el hombro.'],
  },
  carry: {
    tips: ['Camina erguido con los hombros abajo y el abdomen firme.', 'Elige un peso que puedas sujetar sin perder la postura.'],
    mistakes: ['Inclinar el tronco hacia un lado.', 'Dar pasos rápidos y descontrolados.'],
  },
  hang: {
    tips: ['Agarra la barra con toda la mano y los hombros activos.', 'Bájate con cuidado al terminar.'],
    mistakes: ['Soltarte de golpe.', 'Colgar con los hombros totalmente hundidos si notas molestias.'],
  },
  squat: {
    tips: ['Pies firmes y rodillas en la dirección de las puntas.', 'Baja hasta donde mantengas la espalda neutra y los talones apoyados.'],
    mistakes: ['Rodillas que se van hacia dentro.', 'Levantar los talones.', 'Redondear la espalda abajo.'],
  },
  lunge: {
    tips: ['Paso amplio y tronco estable.', 'Empuja con todo el pie de apoyo.'],
    mistakes: ['Rodilla delantera hacia dentro.', 'Pasos demasiado cortos que cargan la rodilla.', 'Perder el equilibrio por ir rápido.'],
  },
  'leg-machine': {
    tips: ['Ajusta la máquina antes de empezar: la rodilla alineada con el eje.', 'Sube y baja con control, sin golpes.'],
    mistakes: ['Despegar la cadera o la espalda del respaldo.', 'Bloquear las rodillas de golpe.'],
  },
  'leg-curl': {
    tips: ['Mantén la cadera apoyada y el movimiento controlado.', 'Haz una pausa breve con la rodilla flexionada.'],
    mistakes: ['Levantar la cadera para ayudarte.', 'Bajar sin control.'],
  },
  thrust: {
    tips: ['Barbilla recogida y costillas abajo.', 'Empuja con los talones y aprieta los glúteos arriba.'],
    mistakes: ['Arquear la zona lumbar arriba.', 'Pies demasiado lejos o demasiado cerca.'],
  },
  abduct: {
    tips: ['Movimiento lento y controlado.', 'Mantén la pelvis estable.'],
    mistakes: ['Balancear el tronco.', 'Recorrido demasiado corto.'],
  },
  calf: {
    tips: ['Pausa arriba y estira bien abajo.', 'Rodillas estables durante todo el recorrido.'],
    mistakes: ['Rebotar en el fondo.', 'Hacer un recorrido corto.'],
  },
  'core-stab': {
    tips: ['Respira de forma continua sin aguantar el aire.', 'Pelvis neutra: aprieta abdomen y glúteos.'],
    mistakes: ['Hundir la cadera.', 'Aguantar la respiración.', 'Mantener la postura cuando la técnica ya se ha perdido.'],
  },
  'core-flex': {
    tips: ['Muévete despacio y sin impulso.', 'Echa el aire al contraer el abdomen.'],
    mistakes: ['Tirar del cuello con las manos.', 'Usar impulso o arquear la zona lumbar.'],
  },
  'core-rot': {
    tips: ['El giro sale del tronco; la cadera se mantiene estable.', 'Controla el movimiento de vuelta.'],
    mistakes: ['Girar sólo los brazos.', 'Ir demasiado rápido.'],
  },
  power: {
    tips: ['Aprende la técnica con poca carga o con un entrenador.', 'La fuerza sale de la cadera y las piernas, no de los brazos.'],
    mistakes: ['Tirar con los brazos antes de extender la cadera.', 'Redondear la espalda.', 'Hacer muchas repeticiones con técnica cansada.'],
  },
  plyo: {
    tips: ['Aterriza suave con las rodillas algo flexionadas.', 'Para cuando la fatiga empeore la técnica.'],
    mistakes: ['Caer con las piernas rígidas.', 'Rodillas hacia dentro al aterrizar.'],
  },
  cardio: {
    tips: ['Empieza suave unos minutos para calentar.', 'Ajusta la intensidad para poder respirar con control.'],
    mistakes: ['Empezar demasiado fuerte.', 'Descuidar la postura cuando llega el cansancio.'],
  },
  mobility: {
    tips: ['Muévete despacio y respira con calma.', 'Busca una tensión suave, nunca dolor.'],
    mistakes: ['Forzar el rango con rebotes.', 'Aguantar la respiración.'],
  },
};
