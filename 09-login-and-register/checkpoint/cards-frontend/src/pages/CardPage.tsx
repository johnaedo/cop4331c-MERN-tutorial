import PageTitle from '../components/PageTitle';
import LoggedInName from '../components/LoggedInName';

const CardPage = () => {
  return (
    <div className="container app-container py-3">
      <PageTitle />
      <LoggedInName />
      <main className="text-center text-secondary">
        Your cards arrive in Step 10.
      </main>
    </div>
  );
};

export default CardPage;
