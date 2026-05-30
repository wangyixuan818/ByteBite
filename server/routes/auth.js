const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const pool = require('../db');         

const router = express.Router();

// import middleware
const authenticateToken = require('../middleware/auth');

router.get('/me', authenticateToken, async (req, res) => {
    try {
        const userRes = await pool.query(
            'SELECT id, email, display_name FROM users WHERE id = $1',
            [req.user.userId]
        );
        
        const user = userRes.rows[0];

        if (!user) {
            return res.status(401).json({ error: {
                code: 'UNAUTHENTICATED',
                message: 'User not found'
            }
        });
        }

        return res.status(200).json({ user });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: {
            code:'SERVER_ERROR' ,
            message: 'Something went wrong'}
    });
    }
});

// signup route
// checking signup deets
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().min(1),
});


router.post('/signup', async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
        const msg = parsed.error.issues.map(i => i.message).join('; ');
    return res.status(400).json({ error: {
        code: 'VALIDATION_ERROR',
        message: msg }
    });
    }

    const { email, password, display_name } = parsed.data;


    // hash the password
    const pwHashed = await bcrypt.hash(password, 10);


    // create user, household, putting into database
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const userRes = await client.query(
            `INSERT INTO users (email, password_hash, display_name)
            VALUES ($1, $2, $3)
            RETURNING id, email, display_name`,
            [email, pwHashed, display_name]
        );
        const user = userRes.rows[0]; // does not contain password

        const householdRes = await client.query(
            `INSERT INTO households (name) VALUES ($1) RETURNING id`,
            [`${display_name}'s Household`]
        );
        const householdId = householdRes.rows[0].id;

        await client.query(
            `INSERT INTO user_household (user_id, household_id, role) VALUES ($1, $2, 'owner')`,
            [user.id, householdId]
        );

        await client.query('COMMIT');


        // create JWT token
        const token = jwt.sign(
            { userId: user.id, householdId }, 
            process.env.JWT_SECRET,
            { expiresIn: '14d' }
        );


        // catch errors
        return res.status(201).json({ user, token }); // user does not contain password
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        if (err.code === '23505') { // unique_violation
            return res.status(409).json({ error: {
                code: 'EMAIL_ALREADY_EXISTS',
                message: 'Email already exists'
            }});
        }
        console.error(err);
        return res.status(500).json({ error: {
            code: 'SERVER_ERROR',
            message: 'Something went wrong'
        }});
    } finally {
        client.release();
    }
});



// login route
// validation for login
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        const msg = parsed.error.issues.map(i => i.message).join('; ');
        return res.status(400).json({ error: {
            code: 'VALIDATION_ERROR',
            message: msg
        }});
    }

    const { email, password } = parsed.data;

    // find user by email
    try {
        const userRes = await pool.query(
            'SELECT id, email, display_name, password_hash FROM users WHERE email = $1',
            [email]
        );

        if (userRes.rows.length === 0) {
            return res.status(401).json({ error: {
                code: 'INVALID_USER',
                message: 'Invalid user'
            }});
        }

        const user = userRes.rows[0];

        // verify password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: {
                code: 'INVALID_PASSWORD',
                message: 'Invalid password'
            }});
        }

        // create JWT token
        const token = jwt.sign(
            { userId: user.id, householdId: null }, 
            process.env.JWT_SECRET,
            { expiresIn: '14d' }
        );

        return res.status(200).json({ 
            user: { id: user.id, email: user.email, display_name: user.display_name }, // remove pw
            token });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: {
            code: 'SERVER_ERROR',
            message: 'Something went wrong'
        }});
    } 
});


// signout
router.post('/signout', (req, res) => {
    return res.status(204).end();
});



module.exports = router;
