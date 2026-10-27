import { useState } from 'react';
import { ChartLine, Dumbbell, LockKeyhole, Scale as ScaleIcon } from 'lucide-react';
import { useSettings } from '../app/context';
import { Button, Field, Input, LogoMark, Segmented, Wordmark } from '../ui/kit';
import { requestPersistentStorage } from '../db/database';

export function Onboarding() {
  const { update } = useSettings();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState(3);
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');

  if (step === 0)
    return (
      <div className="onboard">
        <LogoMark size={72} />
        <h1>DRAXIVO</h1>
        <p className="lead">Train with purpose. Registra tus entrenamientos, tu peso y tu progreso.</p>
        <div className="feature-list">
          <div className="feature">
            <Dumbbell size={24} />
            <div>
              <strong>Rutinas y entrenamientos sin límites</strong>
              <span>Crea todas las rutinas, ejercicios y sesiones que necesites.</span>
            </div>
          </div>
          <div className="feature">
            <ChartLine size={24} />
            <div>
              <strong>Progreso real</strong>
              <span>Récords, volumen, 1RM estimado y revisiones semanales con tus datos.</span>
            </div>
          </div>
          <div className="feature">
            <ScaleIcon size={24} />
            <div>
              <strong>Peso y medidas</strong>
              <span>Tendencia del peso, medidas corporales y fotos privadas.</span>
            </div>
          </div>
          <div className="feature">
            <LockKeyhole size={24} />
            <div>
              <strong>Privado y gratuito</strong>
              <span>Sin cuenta, sin anuncios y sin suscripciones. Tus datos se guardan sólo en este dispositivo.</span>
            </div>
          </div>
        </div>
        <div className="onboard-foot">
          <Button variant="primary" size="lg" block onClick={() => setStep(1)}>
            Empezar
          </Button>
        </div>
      </div>
    );

  return (
    <div className="onboard">
      <Wordmark />
      <h1>Unos ajustes rápidos</h1>
      <p className="lead">Todo es opcional y puedes cambiarlo después en Perfil.</p>
      <div className="mt-lg">
        <Field label="Nombre o alias (opcional)">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cómo quieres que te llamemos" maxLength={40} autoComplete="nickname" />
        </Field>
        <Field label="Sesiones por semana que te gustaría completar" hint="Sirve para calcular tu cumplimiento semanal.">
          <Segmented
            label="Objetivo semanal"
            value={String(goal)}
            onChange={(v) => setGoal(Number(v))}
            options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: String(n) }))}
          />
        </Field>
        <Field label="Unidad de peso">
          <Segmented label="Unidad de peso" value={unit} onChange={setUnit} options={[{ value: 'kg', label: 'Kilogramos' }, { value: 'lb', label: 'Libras' }]} />
        </Field>
      </div>
      <div className="onboard-foot">
        <Button
          variant="primary"
          size="lg"
          block
          onClick={async () => {
            await update({ name: name.trim(), weeklyGoal: goal, weightUnit: unit, onboarded: true });
            requestPersistentStorage();
          }}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
