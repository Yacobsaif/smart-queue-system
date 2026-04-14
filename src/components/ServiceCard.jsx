import React from 'react';
import { Clock, Users } from 'lucide-react';

const ServiceCard = ({ service, waitingCount, onBook }) => {
  // Estimated Wait Time = (Number of people with status 'waiting' or 'calling' ahead) * service_duration
  const estWaitTime = waitingCount * service.estimated_duration_minutes;

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 flex flex-col justify-between hover:shadow-lg transition-shadow duration-300">
      <div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">{service.service_name}</h3>
        
        <div className="flex items-center text-gray-600 mb-2">
          <Users className="w-5 h-5 mr-2 text-indigo-500" />
          <span>{waitingCount} students waiting (or in progress)</span>
        </div>
        
        <div className="flex items-center text-gray-600 mb-6">
          <Clock className="w-5 h-5 mr-2 text-indigo-500" />
          <span>Estimated wait: <strong>{estWaitTime} mins</strong></span>
        </div>
      </div>
      
      <button 
        onClick={() => onBook(service)}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
      >
        Book Now
      </button>
    </div>
  );
};

export default ServiceCard;
