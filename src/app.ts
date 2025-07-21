import express from 'express';
import mainRouter from './routes';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/', mainRouter);

export default app; 