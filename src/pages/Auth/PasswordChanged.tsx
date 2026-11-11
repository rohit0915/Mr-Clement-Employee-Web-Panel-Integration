// src/pages/auth/PasswordUpdatedPage.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import TriaxxLogoImg from '@/assets/LOGOPlande.svg';

const PasswordUpdatedPage: React.FC = () => {
  return (
    <div className="flex min-h-screen items-center justify-center gradient-background-mobile p-4 lg:p-0 lg:bg-[#F8F8F8]">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl text-center">
        <img
          src={TriaxxLogoImg}
          alt="TRIAXX Logo"
          className="h-8 mx-auto mb-6"
        />
        <h1 className="text-2xl font-bold mb-2">Password Updated</h1>
        <p className="text-sm text-[#000000CC] mb-8">
          Your password has been reset successfully. You can now sign in with
          your new password.
        </p>
        <Link
          to="/login"
          className="block w-full bg-primary text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:opacity-90"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
};

export default PasswordUpdatedPage;