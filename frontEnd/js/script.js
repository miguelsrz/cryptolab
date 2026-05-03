const API_BASE = "/api"; 

async function encriptar() {
      const password = document.getElementById('password').value.trim();
      const key = document.getElementById('key').value.trim();
      const resultadoDiv = document.getElementById('resultado');
      const errorDiv = document.getElementById('error');

      resultadoDiv.classList.add('hidden');
      errorDiv.classList.add('hidden');

      if (!password || !key) {
        errorDiv.textContent = 'Por favor ingresa la contraseña y la llave.';
        errorDiv.classList.remove('hidden');
        return;
      }


    try {
        const response = await fetch(`${API_BASE}/encriptar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, key })
            });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Error en la encriptación');
        }
        
        document.getElementById('resultado-texto').textContent = data.encrypted;
        resultadoDiv.classList.remove('hidden');

    }  catch (error) {
        errorDiv.textContent = 'Error: ' + error.message;
        errorDiv.classList.remove('hidden');
        return;
    }



    }