import socket from 'socket.io-client';

let socketInstance = null;
let backendUrl = import.meta.env.VITE_API_URL;

export const intializeSocket = (projectId) => {
    socketInstance = socket(backendUrl, {
        auth: {
            token: localStorage.getItem('token')
        },
        query: {
            projectId
        }
    })
    return socketInstance;
};

export const recieveMessage = (eventName, cb) => {
    socketInstance.on(eventName, cb);
}

export const sendMessage = (eventName, data) => {
    socketInstance.emit(eventName, data);
}