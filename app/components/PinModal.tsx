// app/components/PinModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

interface PinModalProps {
  onSuccess: () => void;
}

export default function PinModal({ onSuccess }: PinModalProps) {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const CORRECT_PIN = '8888';

  // Автофокус на input при загрузке
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Только цифры
    setPin(value);
    setError(false);

    // Если ввели 4 цифры - проверяем
    if (value.length === 4) {
      if (value === CORRECT_PIN) {
        onSuccess();
      } else {
        setError(true);
        setPin('');
        setTimeout(() => {
          setError(false);
        }, 1000);
      }
    }
  };

  // Виртуальная цифровая клавиатура
  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(false);

      if (newPin.length === 4) {
        if (newPin === CORRECT_PIN) {
          onSuccess();
        } else {
          setError(true);
          setPin('');
          setTimeout(() => {
            setError(false);
          }, 1000);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError(false);
  };

  return (
    <div className="pin-modal-overlay">
      <div className="pin-modal">
        <div className="pin-modal-header">
          <div className="pin-lock-icon">🔒</div>
          <h2>Доступ ограничен</h2>
          <p>Введите PIN-код для входа</p>
        </div>

        <div className="pin-display">
          <div className="pin-dots">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`pin-dot ${pin.length > i ? 'filled' : ''} ${error ? 'error' : ''}`}
              />
            ))}
          </div>
          {error && <div className="pin-error">Неверный код</div>}
        </div>

        {/* Скрытый input для поддержки физической клавиатуры */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          pattern="\d*"
          value={pin}
          onChange={handlePinChange}
          className="pin-hidden-input"
          autoComplete="off"
        />

        {/* Цифровая клавиатура */}
        <div className="pin-keyboard">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              className="pin-key"
              onClick={() => handleKeyPress(digit.toString())}
            >
              {digit}
            </button>
          ))}
          <div className="pin-key empty" />
          <button className="pin-key" onClick={() => handleKeyPress('0')}>
            0
          </button>
          <button className="pin-key delete-key" onClick={handleDelete}>
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}