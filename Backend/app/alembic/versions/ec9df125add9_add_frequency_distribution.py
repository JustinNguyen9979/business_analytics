"""add frequency_distribution

Revision ID: ec9df125add9
Revises: f1e7b13548a8
Create Date: 2026-01-05 09:02:09.896211

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'ec9df125add9'
down_revision = 'f1e7b13548a8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('daily_stats', sa.Column('frequency_distribution', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('daily_analytics', sa.Column('frequency_distribution', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade():
    op.drop_column('daily_analytics', 'frequency_distribution')
    op.drop_column('daily_stats', 'frequency_distribution')
