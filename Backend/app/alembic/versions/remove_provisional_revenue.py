"""remove_provisional_revenue

Revision ID: remove_provisional_col
Revises: f2e8c24659b9
Create Date: 2026-01-23 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'remove_provisional_col'
down_revision = 'f2e8c24659b9'
branch_labels = None
depends_on = None

def upgrade():
    # Drop column from daily_stats
    op.drop_column('daily_stats', 'provisional_revenue')
    # Drop column from daily_analytics
    op.drop_column('daily_analytics', 'provisional_revenue')

def downgrade():
    # Add column back if rollback
    op.add_column('daily_stats', sa.Column('provisional_revenue', sa.Float(), nullable=True, server_default='0'))
    op.add_column('daily_analytics', sa.Column('provisional_revenue', sa.Float(), nullable=True, server_default='0'))
