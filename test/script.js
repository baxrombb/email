  const form = document.getElementById('loginForm');
    const message = document.getElementById('message');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        message.textContent = 'Yuborilmoqda...';

        const formData = new URLSearchParams(new FormData(form));

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString()
            });

            const result = await response.json();
            message.textContent = result.success ? 'Xabaringiz tasdiqlandi' : result.message;

            if (result.success) form.reset();
        } catch (error) {
            message.textContent = 'Serverga ulanishda xato.';
        }
    });