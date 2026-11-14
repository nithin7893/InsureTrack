"""policy approval workflow

Revision ID: f3a1c9d2b7e4
Revises: d4f8b2c61a97
Create Date: 2026-11-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a1c9d2b7e4'
down_revision: Union[str, None] = 'd4f8b2c61a97'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'requires_policy_approval',
            sa.Boolean(),
            nullable=True,
            server_default=sa.false(),
        ),
    )

    op.add_column(
        'policies',
        sa.Column(
            'approval_status',
            sa.String(length=20),
            nullable=True,
            server_default='approved',
        ),
    )
    op.add_column('policies', sa.Column('requested_by', sa.Integer(), nullable=True))
    op.add_column('policies', sa.Column('requested_by_name', sa.String(length=255), nullable=True))
    op.add_column('policies', sa.Column('approved_by', sa.Integer(), nullable=True))
    op.add_column('policies', sa.Column('approved_by_name', sa.String(length=255), nullable=True))
    op.add_column('policies', sa.Column('approved_at', sa.DateTime(), nullable=True))
    op.create_index('ix_policy_approval', 'policies', ['approval_status'])

    # Backfill rows that predate the approval workflow.
    op.execute("UPDATE policies SET approval_status = 'approved' WHERE approval_status IS NULL")
    op.execute('UPDATE users SET requires_policy_approval = 0 WHERE requires_policy_approval IS NULL')


def downgrade() -> None:
    op.drop_index('ix_policy_approval', table_name='policies')
    op.drop_column('policies', 'approved_at')
    op.drop_column('policies', 'approved_by_name')
    op.drop_column('policies', 'approved_by')
    op.drop_column('policies', 'requested_by_name')
    op.drop_column('policies', 'requested_by')
    op.drop_column('policies', 'approval_status')
    op.drop_column('users', 'requires_policy_approval')
