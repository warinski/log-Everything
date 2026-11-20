import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import dbConnect from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import bcrypt from 'bcryptjs';

function normalizeFeatures(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(raw).map((item) => String(item));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          await dbConnect();
          const email = String(credentials.email).trim().toLowerCase();
          const user = await User.findOne({ email }).lean();

          if (!user || !(user as any).password) {
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            (user as any).password
          );

          if (!isPasswordValid) {
            return null;
          }

          return {
            id: String((user as any)._id),
            name: String((user as any).name || ''),
            email: String((user as any).email || email),
            role: String((user as any).role || 'user'),
            plan: String((user as any).plan || 'free'),
            features: normalizeFeatures((user as any).features),
          };
        } catch (error) {
          console.error('Error in authorize function:', error);
          return null;
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = String(user.id);
        token.role = String((user as any).role || 'user');
        token.plan = String((user as any).plan || 'free');
        token.features = normalizeFeatures((user as any).features);
      }

      if (trigger === 'update' && token.id) {
        await dbConnect();
        const dbUser = await User.findById(token.id).lean();
        if (dbUser) {
          token.role = String((dbUser as any).role || 'user');
          token.plan = String((dbUser as any).plan || 'free');
          token.features = normalizeFeatures((dbUser as any).features);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = String(token.id || '');
        (session.user as any).role = String(token.role || 'user');
        (session.user as any).plan = String(token.plan || 'free');
        (session.user as any).features = normalizeFeatures(token.features);
      }
      return session;
    },
  },
});