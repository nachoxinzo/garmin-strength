const readline = require('readline');
const path = require('path');
const fs = require('fs');
const {
  GarminClient,
  Garmin,
  FileTokenStore,
  workoutFromSpec
} = require('garminconnect-js');
const { EXERCISES } = require('garminconnect-js/exercises');

// Cargar .env simple si existe
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...vals] = trimmed.split('=');
      if (key && vals.length) {
        process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });
}

function prompt(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

async function main() {
  console.log('\n🚀 === SINCRONIZADOR INALÁMBRICO GARMIN CONNECT ===');
  console.log('Este script conectará con tu cuenta de Garmin Connect y enviará');
  console.log('el entrenamiento de fuerza directamente a tu Garmin Fénix 8 por Bluetooth/Wi-Fi.\n');

  const tokensDir = path.join(__dirname, 'tokens');
  const tokenStore = new FileTokenStore(tokensDir);
  const client = new GarminClient({ tokenStore });

  // 1. Verificar si ya tenemos tokens guardados de una sesión anterior
  const hasTokens = await client.loadTokens();

  if (hasTokens) {
    console.log('🔑 Sesión activa encontrada en ./tokens (No necesitas reintroducir contraseña).');
  } else {
    console.log('🔐 No hay sesión guardada. Iniciando autenticación segura con Garmin Connect...');
    const email = process.env.GARMIN_EMAIL || await prompt('Introduce tu Email de Garmin Connect: ');
    const password = process.env.GARMIN_PASSWORD || await prompt('Introduce tu Contraseña de Garmin Connect: ');

    console.log('\nConectando con Garmin SSO...');
    const loginResult = await client.login(email, password);

    if (loginResult.state === 'mfa_required') {
      console.log('\n📲 Garmin ha solicitado autenticación en dos pasos (MFA / 2FA).');
      console.log('Revisa tu correo o la app de Garmin para ver el código de 6 dígitos.');
      const code = await prompt('Introduce el código de verificación: ');
      await client.resumeLogin(loginResult.mfaState, code);
      console.log('✅ Verificación en dos pasos completada.');
    }

    console.log('✅ Autenticación exitosa. Tokens de sesión guardados en ./tokens para futuros usos.');
  }

  const garmin = new Garmin(client);

  // 2. Obtener perfil y dispositivos asociados
  console.log('\nObteniendo información de tu cuenta y dispositivos...');
  try {
    const profile = await garmin.getUserProfile();
    console.log(`👤 Usuario conectado: ${profile.displayName || profile.userName || 'Usuario Garmin'}`);
  } catch (e) {
    console.log('👤 Conectado a Garmin.');
  }

  // 3. Definir la rutina de fuerza estructurada
  console.log('\nConstruyendo entrenamiento de fuerza ("Fuerza Push & Pierna F8")...');
  const spec = {
    name: 'Fuerza F8 Push',
    sport: 'strength_training',
    steps: [
      // Calentamiento
      { type: 'warmup', time: 300 },

      // Bloque 1: Press de Banca (3 series x 8 reps @ 80kg, 90s descanso)
      {
        type: 'repeat',
        times: 3,
        steps: [
          {
            type: 'interval',
            reps: 8,
            weightKg: 80,
            exercise: { category: 'BENCH_PRESS', name: 'BARBELL_BENCH_PRESS' }
          },
          { type: 'rest', restSeconds: 90 }
        ]
      },

      // Bloque 2: Sentadilla con Barra (3 series x 10 reps @ 100kg, 120s descanso)
      {
        type: 'repeat',
        times: 3,
        steps: [
          {
            type: 'interval',
            reps: 10,
            weightKg: 100,
            exercise: { category: 'SQUAT', name: 'BARBELL_BACK_SQUAT' }
          },
          { type: 'rest', restSeconds: 120 }
        ]
      },

      // Enfriamiento
      { type: 'cooldown', time: 180 }
    ]
  };

  const workoutPayload = workoutFromSpec(spec, EXERCISES);

  // 4. Subir el entrenamiento a Garmin Connect Cloud
  console.log('☁️  Subiendo entrenamiento a Garmin Connect Cloud...');
  const createdWorkout = await garmin.uploadStrengthWorkout(workoutPayload);
  const workoutId = createdWorkout.workoutId;
  console.log(`✅ ¡Entrenamiento creado con éxito en Garmin Connect! (ID: ${workoutId})`);

  // 5. Enviar mensaje de sincronización prioritaria al dispositivo (Fénix 8)
  try {
    console.log('📡 Enviando orden de descarga a tu reloj...');
    await garmin.pushWorkoutToDevice(workoutId);
    console.log('✅ ¡Orden enviada! Tu reloj descargará el entreno al sincronizar por Bluetooth/Wi-Fi.');
  } catch (err) {
    console.log('ℹ️  Nota de envío a dispositivo:', err.message);
    console.log('   (El entrenamiento ya está en tu biblioteca de Garmin Connect y se sincronizará automáticamente).');
  }

  console.log('\n🎯 ¡TODO LISTO!');
  console.log('1. Abre la app Garmin Connect en tu móvil para forzar la sincronización,');
  console.log('   o en tu Fénix 8 mantén pulsado Light -> Sincronizar Wi-Fi / Bluetooth.');
  console.log('2. Entra en Actividades -> Fuerza -> Entrenamientos -> "Fuerza F8 Push".\n');
}

if (require.main === module) {
  main().catch(err => {
    console.error('\n❌ Error durante la sincronización:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  });
}

module.exports = { main };
