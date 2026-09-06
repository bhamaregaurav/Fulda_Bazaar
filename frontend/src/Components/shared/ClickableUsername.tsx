import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ClickableUsernameProps {
  userId: number;
  firstName: string;
  lastName: string;
  className?: string;
  showFullName?: boolean;
}

const ClickableUsername: React.FC<ClickableUsernameProps> = ({
  userId,
  firstName,
  lastName,
  className = '',
  showFullName = true
}) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/profile/${userId}`);
  };

  const displayName = showFullName 
    ? `${firstName} ${lastName}`
    : `${firstName} ${lastName.charAt(0)}.`;

  return (
    <button
      onClick={handleClick}
      className={`text-[#3cb371] hover:text-[#2d8f5a] hover:underline transition-colors duration-200 font-medium ${className}`}
      title={`View ${firstName}'s profile`}
    >
      {displayName}
    </button>
  );
};

export default ClickableUsername; 