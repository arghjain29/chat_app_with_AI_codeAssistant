import { useContext } from 'react';
import { UserContext } from '../context/user.context.jsx';

const Home = () => {
  const {user} = useContext(UserContext);

  return (
    <div className='text-4xl'>
      Welcome {user ? user.username : 'Guest'}
    </div>
  )
}

export default Home
