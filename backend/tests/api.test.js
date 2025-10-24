const request = require('supertest');
const app = require('../server');

describe('GymSage Backend API', () => {
  describe('Health Check', () => {
    test('GET /api/health should return 200', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body.status).toBe('OK');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Authentication', () => {
    test('POST /api/auth/register should create a new user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.message).toBe('User created successfully');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.token).toBeDefined();
    });

    test('POST /api/auth/login should authenticate user', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.message).toBe('Login successful');
      expect(response.body.user.email).toBe(loginData.email);
      expect(response.body.token).toBeDefined();
    });

    test('POST /api/auth/register should reject duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);
    });
  });

  describe('Voice Parsing', () => {
    test('POST /api/voice/parse should parse workout transcript', async () => {
      const transcript = 'Bench press 3 sets of 10 reps at 60 kilograms';
      
      const response = await request(app)
        .post('/api/voice/parse')
        .send({ transcript })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.exercise).toBe('bench press');
      expect(response.body.data.sets).toHaveLength(3);
      expect(response.body.data.sets[0].weight_kg).toBe(60);
    });

    test('POST /api/voice/parse should handle invalid transcript', async () => {
      const transcript = '';
      
      const response = await request(app)
        .post('/api/voice/parse')
        .send({ transcript })
        .expect(400);

      expect(response.body.error).toBe('Transcript is required');
    });
  });

  describe('Workouts', () => {
    let authToken;
    let userId;

    beforeAll(async () => {
      // Register and login to get auth token
      const userData = {
        email: 'workout-test@example.com',
        password: 'password123',
        name: 'Workout Test User'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      authToken = registerResponse.body.token;
      userId = registerResponse.body.user.id;
    });

    test('POST /api/workouts should create a new workout', async () => {
      const workoutData = {
        date: '2024-01-15',
        exercises: [
          {
            exercise: 'bench press',
            sets: [
              { set: 1, reps: 10, weight_kg: 60 },
              { set: 2, reps: 10, weight_kg: 60 },
              { set: 3, reps: 8, weight_kg: 65 }
            ]
          }
        ],
        notes: 'Great workout!'
      };

      const response = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workoutData)
        .expect(201);

      expect(response.body.workout.exercises).toHaveLength(1);
      expect(response.body.workout.exercises[0].exercise).toBe('bench press');
    });

    test('GET /api/workouts should return user workouts', async () => {
      const response = await request(app)
        .get('/api/workouts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.workouts).toBeDefined();
      expect(Array.isArray(response.body.workouts)).toBe(true);
    });

    test('GET /api/workouts/:id should return specific workout', async () => {
      // First create a workout
      const workoutData = {
        date: '2024-01-16',
        exercises: [
          {
            exercise: 'squat',
            sets: [
              { set: 1, reps: 12, weight_kg: 80 }
            ]
          }
        ]
      };

      const createResponse = await request(app)
        .post('/api/workouts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workoutData);

      const workoutId = createResponse.body.workout.id;

      const response = await request(app)
        .get(`/api/workouts/${workoutId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.workout.id).toBe(workoutId);
      expect(response.body.workout.exercises[0].exercise).toBe('squat');
    });
  });

  describe('AI Coach', () => {
    let authToken;

    beforeAll(async () => {
      const userData = {
        email: 'coach-test@example.com',
        password: 'password123',
        name: 'Coach Test User'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      authToken = registerResponse.body.token;
    });

    test('POST /api/coach/chat should respond to user message', async () => {
      const messageData = {
        message: 'How can I improve my bench press?'
      };

      const response = await request(app)
        .post('/api/coach/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData)
        .expect(200);

      expect(response.body.message).toBeDefined();
      expect(response.body.suggestions).toBeDefined();
      expect(Array.isArray(response.body.suggestions)).toBe(true);
    });

    test('GET /api/coach/recommendations should return personalized recommendations', async () => {
      const response = await request(app)
        .get('/api/coach/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.recommendations).toBeDefined();
      expect(response.body.program_mods).toBeDefined();
      expect(response.body.nutrition_tips).toBeDefined();
    });
  });
});
