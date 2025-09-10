import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../services/auth.store';

interface LoginForm {
  email: string;
  password: string;
}

interface RegisterForm {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  phone: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register: registerUser, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  
  const loginForm = useForm<LoginForm>();
  const registerForm = useForm<RegisterForm>();

  const onLogin = async (data: LoginForm) => {
    try {
      await login(data.email, data.password);
      navigate('/');
    } catch (error) {
      // Error handled by auth store
    }
  };

  const onRegister = async (data: RegisterForm) => {
    try {
      await registerUser(data);
      navigate('/');
    } catch (error) {
      // Error handled by auth store
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <img 
          src="/paycile-logo.png" 
          alt="Paycile" 
          className="mx-auto h-16 w-auto"
        />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {isRegisterMode ? 'Create broker account' : 'Sign in to your account'}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-soft sm:rounded-lg sm:px-10">
          {/* Tabs */}
          <div className="flex mb-6 border-b">
            <button
              type="button"
              className={`flex-1 pb-2 text-sm font-medium ${
                !isRegisterMode
                  ? 'border-b-2 border-primary-500 text-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setIsRegisterMode(false)}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`flex-1 pb-2 text-sm font-medium ${
                isRegisterMode
                  ? 'border-b-2 border-primary-500 text-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setIsRegisterMode(true)}
            >
              Broker Sign Up
            </button>
          </div>

          {!isRegisterMode ? (
            <form className="space-y-6" onSubmit={loginForm.handleSubmit(onLogin)}>
              <div>
                <label htmlFor="email" className="label">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="input"
                  {...loginForm.register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                />
                {loginForm.formState.errors.email && (
                  <p className="mt-1 text-sm text-error-600">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="input pr-10"
                    {...loginForm.register('password', {
                      required: 'Password is required',
                    })}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="mt-1 text-sm text-error-600">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full btn-primary btn-lg"
                >
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={registerForm.handleSubmit(onRegister)}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="label">
                    First Name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    className="input"
                    {...registerForm.register('firstName', { required: 'First name is required' })}
                  />
                  {registerForm.formState.errors.firstName && (
                    <p className="mt-1 text-sm text-error-600">{registerForm.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="lastName" className="label">
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    className="input"
                    {...registerForm.register('lastName', { required: 'Last name is required' })}
                  />
                  {registerForm.formState.errors.lastName && (
                    <p className="mt-1 text-sm text-error-600">{registerForm.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="companyName" className="label">
                  Brokerage Company Name
                </label>
                <input
                  id="companyName"
                  type="text"
                  className="input"
                  {...registerForm.register('companyName', { required: 'Company name is required' })}
                />
                {registerForm.formState.errors.companyName && (
                  <p className="mt-1 text-sm text-error-600">{registerForm.formState.errors.companyName.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-email" className="label">
                  Email address
                </label>
                <input
                  id="reg-email"
                  type="email"
                  className="input"
                  {...registerForm.register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                />
                {registerForm.formState.errors.email && (
                  <p className="mt-1 text-sm text-error-600">{registerForm.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="label">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  className="input"
                  {...registerForm.register('phone', { required: 'Phone number is required' })}
                />
                {registerForm.formState.errors.phone && (
                  <p className="mt-1 text-sm text-error-600">{registerForm.formState.errors.phone.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-password" className="label">
                  Password
                </label>
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  {...registerForm.register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters',
                    },
                  })}
                />
                {registerForm.formState.errors.password && (
                  <p className="mt-1 text-sm text-error-600">{registerForm.formState.errors.password.message}</p>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full btn-primary btn-lg"
                >
                  {isLoading ? 'Creating account...' : 'Create Broker Account'}
                </button>
              </div>
            </form>
          )}

          {/* Demo credentials */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 text-center">Demo Credentials:</p>
            <div className="mt-2 space-y-1 text-xs text-gray-500 text-center">
              <p className="font-semibold">Admin:</p>
              <p>danny@nbrain.ai / Tm0bile#88</p>
              <p className="font-semibold mt-2">Brokers:</p>
              <p>broker1@paycile.com / any password</p>
              <p className="font-semibold mt-2">Agents:</p>
              <p>john.smith@paycile.com / any password</p>
              <p>sarah.johnson@paycile.com / any password</p>
              <p>michael.brown@paycile.com / any password</p>
              <p>emily.davis@paycile.com / any password</p>
              <p>robert.wilson@paycile.com / any password</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 