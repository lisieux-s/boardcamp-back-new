import dayjs from 'dayjs';
import db from '../db.js';

export async function createRental(req, res) {
  const rental = req.body;

  try {
    if (rental.daysRented <= 0) return res.sendStatus(400);

    const customerData = await db.query(
      `
    SELECT * FROM customers WHERE id=$1
    `,
      [rental.customerId]
    );
    if (customerData.rowCount === 0) return res.sendStatus(400);

    const gameData = await db.query(
      `
    SELECT * FROM games 
    WHERE id=$1
    `,
      [rental.gameId]
    );
    if (gameData.rowCount === 0) return res.sendStatus(400);

    const gameRentals = await db.query(
      `
    SELECT * FROM rentals
    WHERE "gameId"=$1 AND "returnDate" is null
    `,
      [rental.gameId]
    );
    if (gameRentals.rowCount === gameData.rows[0].stockTotal) {
      return res.status(400).send('Todas as unidades já alugadas');
    }
    

    const originalPrice = gameData.rows[0].pricePerDay * rental.daysRented;
    await db.query(
      `
        INSERT INTO
            rentals (
                "customerId", 
                "gameId", 
                "rentDate", 
                "daysRented", 
                "returnDate", 
                "originalPrice",
                "delayFee"
                )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
      [
        rental.customerId,
        rental.gameId,
        dayjs().format('DD/MM/YYYY'),
        rental.daysRented,
        rental.returnDate,
        originalPrice,
        rental.delayFee,
      ]
    );

    res.sendStatus(201);
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
}

export async function getRentals(req, res) {
  const gameId = req.query.gameId;
  const customerId = req.query.customerId;

  try {
    if(gameId) {
      const result = await db.query(`
        SELECT * FROM rentals
        WHERE "gameId"=$1
        `, [gameId]);

    res.send(result.rows);
    }
    if(customerId) {
      const result = await db.query(`
        SELECT * FROM rentals
        WHERE "customerId"=$1
        `, [customerId]);

    res.send(result.rows);
    }

    const result = await db.query(`
        SELECT * FROM rentals`);

    res.send(result.rows);
  } catch (err) {
    res.status(500).send(err);
  }
}

export async function updateRental(req, res) {
  const id = req.params.id;

  try {
    const result = await db.query(
      `
  SELECT
    rentals.*,
    games."pricePerDay" AS "pricePerDay"
  FROM rentals 
    JOIN games ON games.id=rentals."gameId"
  WHERE rentals.id=$1
  `,
      [id]
    );

    if (result.rowCount === 0)
      return res.status(404).send('Aluguel não existente');

    const rental = result.rows[0];
    if (rental.returnDate !== null)
      return res.status(400).send('Aluguel já finalizado');

    const returnDate = dayjs();
    const diff = returnDate.diff(result.rentDate, 'day');
    const delayFee = 0;

    if (diff > rental.daysRented) {
      delayFee = rental.pricePerDay * diff;
    }

    await db.query(
      `
    UPDATE rentals
      SET "returnDate"=$1,
          "delayFee"=$2
  `,
      [returnDate, delayFee]
    );
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err);
  }
}

export async function deleteRental(req, res) {
  const id = req.params.id;

  try {
    const result = await db.query(
      `
        SELECT * FROM rentals WHERE id=$1
        `,
      [id]
    );
    if (result.rowCount < 1) {
      return res.sendStatus(404);
    }
    if (result.rows[0].returnDate !== null) {
      return res.sendStatus(400);
    }

    await db.query(
      `
        DELETE FROM rentals WHERE id=$1
        `,
      [id]
    );
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err);
  }
}
