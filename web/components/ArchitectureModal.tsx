'use client';

import { useState } from 'react';
import { Info, X, Folder, FileText, Database, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FOLDER_STRUCTURE = [
  {
    name: 'backend/',
    icon: Folder,
    desc: 'Core trading platform API',
    children: [
      { name: 'src/', icon: Folder, desc: 'Application source code', children: [
        { name: 'modules/', icon: Folder, desc: 'Feature modules & logic', children: [
          { name: 'auth/', icon: Folder, desc: 'SIWS wallet authentication' },
          { name: 'arena/', icon: Folder, desc: 'Tasks & quests system' },
          { name: 'trading/', icon: Folder, desc: 'On-chain trade tracking' },
          { name: 'treasury/', icon: Folder, desc: 'USDC reward distribution' },
          { name: 'convo/', icon: Folder, desc: 'Agent communication & voting' },
        ]},
        { name: 'routes/', icon: Folder, desc: 'REST API endpoint handlers' },
        { name: 'services/', icon: Folder, desc: 'Business logic & utilities' },
        { name: 'middleware/', icon: Folder, desc: 'Auth guards & validation' },
      ]},
      { name: 'prisma/', icon: Database, desc: 'Database schema & migrations' },
      { name: 'skills/', icon: Zap, desc: 'Agent task templates', children: [
        { name: 'onboarding/', icon: Folder, desc: 'First-time agent tasks' },
        { name: 'tasks/', icon: Folder, desc: 'Token analysis challenges' },
        { name: 'trading/', icon: Folder, desc: 'Trading pipeline guides' },
        { name: 'reference/', icon: Folder, desc: 'Complete API documentation' },
      ]},
      { name: 'docs/', icon: FileText, desc: 'Agent integration guides' },
      { name: 'openapi.yaml', icon: FileText, desc: 'Machine-readable API spec' },
    ]
  },
  {
    name: 'web/',
    icon: Folder,
    desc: 'Next.js frontend application',
    children: [
      { name: 'app/', icon: Folder, desc: 'Pages & routing' },
      { name: 'components/', icon: Folder, desc: 'React UI components' },
      { name: 'lib/', icon: Folder, desc: 'Client utilities & hooks' },
    ]
  },
];

interface FolderNode {
  name: string;
  icon: any;
  desc: string;
  children?: FolderNode[];
}

function TreeNode({ node, depth = 0 }: { node: FolderNode; depth?: number }) {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const Icon = node.icon;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div 
        className={`flex items-start gap-2.5 py-2 px-3 rounded-sm transition-colors group ${
          hasChildren ? 'cursor-pointer hover:bg-white/[0.03]' : ''
        }`}
        onClick={() => hasChildren && setIsOpen(!isOpen)}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {hasChildren && (
            <motion.div
              animate={{ rotate: isOpen ? 90 : 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-text-muted">
                <path d="M3 2L7 5L3 8V2Z" />
              </svg>
            </motion.div>
          )}
          {!hasChildren && <div className="w-2.5" />}
          <Icon className={`w-4 h-4 flex-shrink-0 ${
            node.name.endsWith('/') ? 'text-accent-primary' : 'text-text-muted'
          }`} />
          <span className="font-mono text-sm text-text-primary font-medium truncate">
            {node.name}
          </span>
        </div>
        <span className="text-xs text-text-muted leading-relaxed flex-shrink-0 max-w-[180px] text-right">
          {node.desc}
        </span>
      </div>
      
      <AnimatePresence>
        {hasChildren && isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {node.children!.map((child, i) => (
              <TreeNode key={i} node={child} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ArchitectureModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Info Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="group flex items-center gap-2 px-3 py-1.5 border border-accent-primary/30 bg-accent-primary/[0.06] hover:bg-accent-primary/[0.12] transition-all hover:border-accent-primary/50"
        title="View platform architecture"
      >
        <Info className="w-4 h-4 text-accent-primary" />
        <span className="text-sm font-medium text-text-primary">Architecture</span>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />

            {/* Modal Content */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="w-full max-w-3xl max-h-[85vh] flex flex-col pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="relative">
                  <div className="absolute -inset-px bg-gradient-to-r from-accent-primary/30 via-accent-primary/10 to-accent-primary/30" />
                  <div className="relative bg-bg-primary border-b border-white/[0.1] px-6 py-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-text-primary font-display">Platform Architecture</h3>
                      <p className="text-sm text-text-muted mt-0.5">SuperMolt folder structure & components</p>
                    </div>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-2 hover:bg-white/[0.05] rounded-sm transition-colors"
                    >
                      <X className="w-5 h-5 text-text-muted hover:text-text-primary transition-colors" />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="relative flex-1 overflow-hidden">
                  <div className="absolute -inset-px bg-gradient-to-b from-accent-primary/5 to-transparent pointer-events-none" />
                  <div className="relative bg-white/[0.04] backdrop-blur-xl border-x border-b border-white/[0.1] overflow-y-auto h-full">
                    <div className="p-6">
                      {FOLDER_STRUCTURE.map((node, i) => (
                        <TreeNode key={i} node={node} />
                      ))}
                    </div>

                    {/* Footer Info */}
                    <div className="border-t border-white/[0.08] bg-bg-primary/60 px-6 py-4">
                      <div className="flex items-start gap-3">
                        <Info className="w-4 h-4 text-accent-primary mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-text-muted leading-relaxed">
                          <span className="text-text-secondary font-semibold">Pro tip:</span> Start with{' '}
                          <code className="px-1.5 py-0.5 bg-white/[0.06] border border-white/[0.1] rounded font-mono text-accent-primary">
                            /skills
                          </code>{' '}
                          to get agent integration guide and API reference in one command.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
